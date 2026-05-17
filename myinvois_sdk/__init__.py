#!/usr/bin/env python3
"""
MyInvois 自开发票自动提交方案
LHDN Malaysia e-Invoice Self-Billed Invoice Auto-Submit
Author: 007 🕶️
"""
import json
import time
import hashlib
import base64
import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional

import requests

# ─── 配置 ──────────────────────────────────────────────
# 环境: sandbox / prod
ENV = "sandbox"

CONFIG = {
    "sandbox": {
        "api_base": "https://preprod-api.myinvois.hasil.gov.my",
        "identity": "https://preprod-api.myinvois.hasil.gov.my",  # 身份服务跟 API 同地址
        "portal": "https://preprod.myinvois.hasil.gov.my",
    },
    "prod": {
        "api_base": "https://api.myinvois.hasil.gov.my",
        "identity": "https://api.myinvois.hasil.gov.my",
        "portal": "https://myinvois.hasil.gov.my",
    },
}

# ⚡ 填入你的凭证
CLIENT_ID = "your_client_id"
CLIENT_SECRET = "your_client_secret"
TIN = "your_tin"  # 税号

log = logging.getLogger("myinvois")
log.setLevel(logging.DEBUG)
ch = logging.StreamHandler()
ch.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
log.addHandler(ch)


# ═══════════════════════════════════════════════════════
# 1. TOKEN 管理
# ═══════════════════════════════════════════════════════

class TokenManager:
    """OAuth 2.0 Client Credentials token 管理，自动刷新"""

    def __init__(self, client_id: str, client_secret: str, identity_url: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.token_url = f"{identity_url}/connect/token"
        self._token: Optional[str] = None
        self._expires_at: float = 0

    def get_token(self, force: bool = False) -> str:
        """获取有效 token，过期自动刷新"""
        if not force and self._token and time.time() < self._expires_at - 60:
            return self._token

        r = requests.post(self.token_url, data={
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "client_credentials",
            "scope": "InvoicingAPI",  # 可选
        }, timeout=30)
        r.raise_for_status()
        body = r.json()

        self._token = body["access_token"]
        expires_in = body.get("expires_in", 3600)
        self._expires_at = time.time() + expires_in
        log.info("Token 刷新成功，有效期 %d 秒", expires_in)
        return self._token


# ═══════════════════════════════════════════════════════
# 2. API 客户端（自动带token + 重试）
# ═══════════════════════════════════════════════════════

class MyInvoisClient:
    """封装的 API 客户端，自动处理 token 过期重试"""

    def __init__(self, token_mgr: TokenManager, api_base: str):
        self.token_mgr = token_mgr
        self.api_base = api_base
        self.session = requests.Session()

    def _headers(self, content_type: str = "application/json") -> dict:
        return {
            "Authorization": f"Bearer {self.token_mgr.get_token()}",
            "Content-Type": content_type,
            "Accept": "application/json",
        }

    def _request(self, method: str, path: str, **kwargs) -> requests.Response:
        """带自动 token 刷新重试的请求"""
        headers = self._headers(kwargs.pop("content_type", "application/json"))
        kwargs.setdefault("timeout", 60)
        kwargs["headers"] = headers

        r = self.session.request(method, f"{self.api_base}{path}", **kwargs)

        if r.status_code == 401:
            log.warning("Token 过期，自动刷新重试...")
            self.token_mgr.get_token(force=True)
            headers["Authorization"] = f"Bearer {self.token_mgr.get_token()}"
            r = self.session.request(method, f"{self.api_base}{path}", **kwargs)

        r.raise_for_status()
        return r

    def validate_tin(self, tin: str) -> dict:
        """验证 TIN"""
        r = self._request("GET", f"/api/v1.0/taxpayer/{tin}")
        return r.json()

    def submit_documents(self, documents: list, content_type: str = "application/json") -> dict:
        """提交文档"""
        body = {"documents": documents}
        r = self._request("POST", "/api/v1.0/documentsubmissions/",
                          json=body, content_type=content_type)
        return r.json()

    def get_document(self, doc_uuid: str) -> dict:
        """获取文档详情"""
        r = self._request("GET", f"/api/v1.0/documents/{doc_uuid}")
        return r.json()

    def get_submission(self, submission_uuid: str) -> dict:
        """获取提交结果"""
        r = self._request("GET", f"/api/v1.0/documentsubmissions/{submission_uuid}")
        return r.json()

    def cancel_document(self, doc_uuid: str, reason: str = "") -> dict:
        """取消文档"""
        body = {"reason": {"language": "en", "value": reason}}
        r = self._request("PUT", f"/api/v1.0/documents/{doc_uuid}/cancel", json=body)
        return r.json()


# ═══════════════════════════════════════════════════════
# 3. 自开发票生成
# ═══════════════════════════════════════════════════════

class SelfBilledInvoiceBuilder:
    """
    自开发票（Self-Billed Invoice）构建器
    场景：买方替未注册电子发票的供应商开发票
    遵循 UBL 2.1 + MyInvois 文档类型定义
    """

    def __init__(self, supplier_tin: str, supplier_name: str,
                 buyer_tin: str, buyer_name: str, buyer_address: dict):
        self.supplier_tin = supplier_tin
        self.supplier_name = supplier_name
        self.buyer_tin = buyer_tin
        self.buyer_name = buyer_name
        self.buyer_address = buyer_address

    def build_invoice(self, invoice_no: str, issue_date: str,
                      lines: list, currency: str = "MYR") -> dict:
        """
        构建一张自开发票 JSON payload

        Args:
            invoice_no: 发票号 (如 INV-2026-0001)
            issue_date: 开票日期 (YYYY-MM-DD)
            lines:      [{description, quantity, unit_price, tax_rate, tax_amount}, ...]
            currency:   币种，默认 MYR

        Returns:
            UBL 2.1 Invoice JSON object
        """
        line_items = []
        total_net = 0.0
        total_tax = 0.0

        for i, line in enumerate(lines, 1):
            net = round(line["quantity"] * line["unit_price"], 2)
            tax = round(net * line.get("tax_rate", 0.08), 2)
            gross = round(net + tax, 2)
            total_net += net
            total_tax += tax

            line_items.append({
                "id": {"_text": str(i)},
                "invoicedQuantity": {"_text": str(line["quantity"]), "unitCode": "C62"},
                "lineExtensionAmount": {"_text": f"{net:.2f}", "currencyID": currency},
                "item": {
                    "name": {"_text": line["description"]},
                },
                "price": {
                    "priceAmount": {"_text": f"{line['unit_price']:.2f}", "currencyID": currency},
                },
                "classifiedTaxCategory": {
                    "id": {"_text": str(line.get("tax_rate", 0.08) * 100)[:2]},
                    "percent": {"_text": str(line.get("tax_rate", 0.08))},
                    "taxScheme": {
                        "id": {"_text": "OTH", "schemeID": "UN/ECE 5153",
                               "schemeAgencyID": "6"},
                    },
                },
            })

        total_gross = round(total_net + total_tax, 2)

        invoice = {
            "invoice": {
                "ublVersionID": {"_text": "2.1"},
                "customizationID": {"_text": "1.0"},
                "id": {"_text": invoice_no},
                "issueDate": {"_text": issue_date},
                "invoiceTypeCode": {
                    "_text": "01",  # 01=Invoice, 02=Self-Billed
                    "listID": "UN/ECE 1001",
                    "listAgencyID": "6",
                },
                # ─── 供应方（实际是买方在自开场景下） ───
                "accountingSupplierParty": {
                    "party": {
                        "industryClassificationCode": {"_text": "00000"},
                        "partyIdentification": [{
                            "id": {"_text": self.buyer_tin,
                                   "schemeID": "TIN",
                                   "schemeAgencyID": "MY-LHDN"},
                        }],
                        "partyName": {"name": {"_text": self.buyer_name}},
                        "postalAddress": {
                            "country": {"identificationCode": {"_text": "MY"}},
                        },
                    },
                },
                # ─── 购买方（实际是供应商） ───
                "accountingCustomerParty": {
                    "party": {
                        "partyIdentification": [{
                            "id": {"_text": self.supplier_tin,
                                   "schemeID": "TIN",
                                   "schemeAgencyID": "MY-LHDN"},
                        }],
                        "partyName": {"name": {"_text": self.supplier_name}},
                        "postalAddress": {
                            "country": {"identificationCode": {"_text": "MY"}},
                        },
                    },
                },
                "legalMonetaryTotal": {
                    "lineExtensionAmount": {"_text": f"{total_net:.2f}", "currencyID": currency},
                    "taxExclusiveAmount": {"_text": f"{total_net:.2f}", "currencyID": currency},
                    "taxInclusiveAmount": {"_text": f"{total_gross:.2f}", "currencyID": currency},
                    "payableAmount": {"_text": f"{total_gross:.2f}", "currencyID": currency},
                },
                "invoiceLine": line_items,
            }
        }
        return invoice


# ═══════════════════════════════════════════════════════
# 4. 文档签名 + 提交包装
# ═══════════════════════════════════════════════════════

class DocumentPreparer:
    """
    文档准备：序列化 → 计算 hash → 打包提交结构
    注意：生产环境中，数字签名需要在序列化后、
    提交前使用你的私钥签发。
    这里使用简单 SHA256 hash 作为示例，
    实际签名请参考 MyInvois 签章规范。
    """

    @staticmethod
    def prepare(doc: dict, format: str = "JSON",
                code_number: str = "") -> dict:
        """
        准备提交用的文档结构

        Args:
            doc:          文档 payload (dict)
            format:       格式 JSON 或 XML
            code_number:  文档参考号

        Returns:
            {format, document, documentHash, codeNumber}
        """
        # 序列化为 JSON 字符串
        if format == "JSON":
            doc_str = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
        else:
            raise ValueError("XML 暂未实现，使用 JSON 格式")

        # ⚡ 此处应有数字签名！
        # 生产环境：用你的私钥对 doc_str 签发 CMS/PAdES 签名
        # 参考 MyInvois Digital Signature Spec
        # signed_doc = sign_document(doc_str, private_key_path)

        # Base64 编码
        doc_b64 = base64.b64encode(doc_str.encode("utf-8")).decode("utf-8")

        # SHA256 hash
        doc_hash = hashlib.sha256(doc_str.encode("utf-8")).hexdigest().upper()

        return {
            "format": format,
            "document": doc_b64,
            "documentHash": doc_hash,
            "codeNumber": code_number or f"INV-{uuid.uuid4().hex[:8].upper()}",
        }


# ═══════════════════════════════════════════════════════
# 5. 执行引擎（主流程）
# ═══════════════════════════════════════════════════════

class SelfBilledEngine:
    """自开发票自动提交引擎"""

    def __init__(self, client: MyInvoisClient, invoice_builder: SelfBilledInvoiceBuilder):
        self.client = client
        self.builder = invoice_builder

    def run(self, invoice_no: str, issue_date: str, lines: list,
            currency: str = "MYR") -> dict:
        """完整流程：构建 → 准备 → 提交 → 轮询结果"""
        log.info("=" * 60)
        log.info("开始处理发票: %s", invoice_no)

        # Step 1: 验证对方 TIN
        log.info("[1/5] 验证 TIN: %s", self.builder.supplier_tin)
        tin_info = self.client.validate_tin(self.builder.supplier_tin)
        log.info("  TIN 有效: %s", tin_info.get("name", "N/A"))

        # Step 2: 构建发票
        log.info("[2/5] 构建发票 JSON...")
        invoice = self.builder.build_invoice(invoice_no, issue_date, lines, currency)

        # Step 3: 准备提交结构（hash + base64）
        log.info("[3/5] 计算 hash + base64 编码...")
        doc_pkg = DocumentPreparer.prepare(invoice, code_number=invoice_no)

        # Step 4: 提交到 MyInvois
        log.info("[4/5] 提交到 MyInvois...")
        result = self.client.submit_documents([doc_pkg])
        submission_id = result.get("submissionUID", "N/A")
        log.info("  提交 ID: %s", submission_id)
        for doc in result.get("acceptedDocuments", []):
            log.info("  文档 UUID: %s (internalId=%s)",
                     doc.get("uuid"), doc.get("internalId"))

        # Step 5: 轮询验证结果
        log.info("[5/5] 轮询验证结果...")
        status = self._poll_submission(submission_id)
        log.info("✅ 完成: %s -> %s", invoice_no, status)
        return {"submission_id": submission_id, "status": status, **result}

    def _poll_submission(self, submission_id: str,
                         max_retries: int = 12, interval: int = 10) -> str:
        """轮询提交结果，最多等 2 分钟"""
        for i in range(max_retries):
            time.sleep(interval)
            try:
                sub = self.client.get_submission(submission_id)
                # 检查每个文档的状态
                statuses = set()
                for doc in sub.get("documentSummary", []):
                    s = doc.get("status", "")
                    statuses.add(s)
                    log.debug("  文档 %s: status=%s", doc.get("internalId"), s)

                if "1" not in statuses:  # 没有 Pending 的就完成了
                    return ", ".join(statuses) if statuses else "completed"
                log.info("  等待中... (%d/%d)", i + 1, max_retries)
            except requests.RequestException as e:
                log.warning("  轮询失败: %s，重试", e)

        return "timeout"


# ═══════════════════════════════════════════════════════
# 6. 使用示例
# ═══════════════════════════════════════════════════════

if __name__ == "__main__":
    cfg = CONFIG[ENV]

    # 初始化
    token_mgr = TokenManager(CLIENT_ID, CLIENT_SECRET, cfg["identity"])
    client = MyInvoisClient(token_mgr, cfg["api_base"])

    # 自开发票构建器
    # 场景：你的公司(买方)替供应商(未注册电子发票)开发票
    builder = SelfBilledInvoiceBuilder(
        supplier_tin="C1234567890",       # 供应商 TIN
        supplier_name="供应商公司 Sdn Bhd",
        buyer_tin=TIN,                     # 你的 TIN
        buyer_name="你的公司 Sdn Bhd",
        buyer_address={},
    )

    # 创建发票行
    lines = [
        {"description": "办公用品 - A4纸 x 10箱", "quantity": 10,
         "unit_price": 25.00, "tax_rate": 0.08},
        {"description": "打印服务", "quantity": 1,
         "unit_price": 500.00, "tax_rate": 0.08},
    ]

    # 执行
    engine = SelfBilledEngine(client, builder)
    today = datetime.now().strftime("%Y-%m-%d")
    result = engine.run(
        invoice_no=f"SB-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
        issue_date=today,
        lines=lines,
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))
