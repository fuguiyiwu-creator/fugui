# 富贵 MyInvois SDK

马来西亚 LHDN 电子发票（MyInvois）自动提交解决方案。

## 功能

- ✅ OAuth 2.0 自动认证 & Token 刷新
- ✅ 自开发票（Self-Billed Invoice）JSON 构建
- ✅ 文档提交 & 异步结果轮询
- ✅ 自动重试（401 过期续 token）
- ✅ Sandbox / Production 环境切换
- ✅ TIN 验证
- ✅ 文档取消

## 快速开始

```bash
pip install requests
```

编辑 `config/settings.py` 填入凭证：

```python
CLIENT_ID = "your_client_id"
CLIENT_SECRET = "your_client_secret"
TIN = "your_tin"
```

运行：

```bash
python -m myinvois_sdk
```

## 项目结构

```
├── myinvois_sdk/
│   └── __init__.py       # SDK 核心
├── config/
│   └── settings.py       # 配置（不入库）
├── examples/
│   └── auto_submit.py    # 自开发票示例
├── web/                  # Vercel 前端
│   ├── src/app/
│   │   ├── page.js       # 主面板
│   │   └── api/          # API 代理
│   ├── package.json
│   └── vercel.json
└── README.md
```

## API 文档

官方 SDK 文档：https://sdk.myinvois.hasil.gov.my/

## 环境变量设置（Vercel 部署）

| 变量 | 值 |
|------|-----|
| `MYINVOIS_CLIENT_ID` | `4d22546d-b2c4-420b-b542-893ab9cbebbb` |
| `MYINVOIS_CLIENT_SECRET` | 用 **Secret 1** (`36d6db2f...`)，轮换时切 Secret 2 |
| `MYINVOIS_TIN` | `C60122406100` |
| `MYINVOIS_ENV` | `prod`（测试）/ `prod`（正式） |

> 本地测试：复制 `config/settings_local.py` 填入真实值
> 注意：`config/settings_local.py` 已加入 `.gitignore`，不会提交到仓库
