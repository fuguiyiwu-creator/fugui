#!/usr/bin/env python3
"""
自开发票自动提交示例
"""
import sys
import json
from datetime import datetime

sys.path.insert(0, "..")

from myinvois_sdk import (
    TokenManager, MyInvoisClient,
    SelfBilledInvoiceBuilder, DocumentPreparer, SelfBilledEngine,
    CONFIG,
)

# ⚡ 填入你的凭证
CLIENT_ID = "your_client_id"
CLIENT_SECRET = "your_client_secret"
TIN = "your_tin"

ENV = "sandbox"

cfg = CONFIG[ENV]
token_mgr = TokenManager(CLIENT_ID, CLIENT_SECRET, cfg["identity"])
client = MyInvoisClient(token_mgr, cfg["api_base"])

# 自开发票 — 买方替供应商开
builder = SelfBilledInvoiceBuilder(
    supplier_tin="C1234567890",
    supplier_name="供应商公司 Sdn Bhd",
    buyer_tin=TIN,
    buyer_name="你的公司 Sdn Bhd",
    buyer_address={},
)

lines = [
    {"description": "A4纸 x 10箱", "quantity": 10, "unit_price": 25.00, "tax_rate": 0.08},
    {"description": "打印服务", "quantity": 1, "unit_price": 500.00, "tax_rate": 0.08},
]

engine = SelfBilledEngine(client, builder)
today = datetime.now().strftime("%Y-%m-%d")
ts = datetime.now().strftime("%Y%m%d-%H%M%S")

result = engine.run(
    invoice_no=f"SB-{ts}",
    issue_date=today,
    lines=lines,
)

print(json.dumps(result, indent=2, ensure_ascii=False))
