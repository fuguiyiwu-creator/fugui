# 富贵 MyInvois Web

MyInvois 电子发票管理前端，部署到 Vercel。

## 部署步骤

1. Fork / Clone 本仓库到 GitHub
2. 在 [Vercel](https://vercel.com) 导入该仓库
3. 设置以下环境变量：

| 变量 | 说明 |
|------|------|
| `MYINVOIS_CLIENT_ID` | 你的 Client ID |
| `MYINVOIS_CLIENT_SECRET` | 你的 Client Secret |
| `MYINVOIS_TIN` | 你的税号 |
| `MYINVOIS_ENV` | `sandbox` 或 `prod`（可选，默认 sandbox） |

4. 部署即可

## 本地开发

```bash
npm install
MYINVOIS_CLIENT_ID=xxx MYINVOIS_CLIENT_SECRET=xxx MYINVOIS_TIN=xxx npm run dev
```
