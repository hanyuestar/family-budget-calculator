# Git / GitHub 部署说明

> 本文件记录「聚合计算」小程序仓库的 Git 与 GitHub 推送规范，供后续开发、CI、交接参考。
> ⚠️ 出于安全，本文**不存放任何 Token 明文**；PAT 由持有者按会话提供、内联使用、不落盘。

## 1. 仓库信息

| 项 | 值 |
|---|---|
| 远程仓库 | `https://github.com/hanyuestar/family-budget-calculator.git` |
| 可见性 | 私有（private） |
| 默认分支 | `main` |
| 所有者 | `hanyuestar` |
| 本地目录 | `C:\Users\19625\.qclaw\workspace\family-budget-calculator` |

## 2. 作者身份与邮箱策略

- 提交作者名：`hanyuestar`
- 提交邮箱：**GitHub 官方 noreply 地址** `170588330+hanyuestar@users.noreply.github.com`
  - 该地址由 GitHub 按账号 ID（170588330）自动生成，专用于「私密邮箱」模式。
  - 用该地址提交：**贡献图计入 hanyuestar 名下，且真实邮箱不公开**。
  - 切勿用真实邮箱（如 `2629956488@qq.com`）作为提交邮箱——会被 GitHub 的 GH007 拦截（见 §5）。

本地设置（仓库级，已配置）：
```bash
git config user.name  "hanyuestar"
git config user.email "170588330+hanyuestar@users.noreply.github.com"
```

## 3. 沙箱推送工作流（必须走代理）

本机 Bash 沙箱出网需经本地代理，直连会被拦。

```bash
# 推送命令模板（PAT 仅内联，不写入 .git/config）
git -c http.proxy=http://127.0.0.1:7897 \
    push https://hanyuestar:<PAT>@github.com/hanyuestar/family-budget-calculator.git main
```

要点：
- `http.proxy=http://127.0.0.1:7897` 必须显式带上（沙箱 git 不自动读环境代理）。
- PAT 用 `https://hanyuestar:<PAT>@...` 内联，推送完成后 `remote.origin.url` 仍保持无 token 的干净形式。
- Fine-grained PAT 必须**显式授权本仓库**（权限 `Contents: Read and write`）；未授权会报 `403 Write access not granted`（API 查仓库返回 404）。

## 4. .gitignore 已排除项

以下不纳入版本库（已在根 `.gitignore`）：
- `tarot-sources/` —— 塔罗卡面源图（约 69MB，仅本地备份/再生成用）
- `v2.1.1.7z` / `v2.2.1.7z` —— 旧版本备份压缩包
- `.workbuddy/` —— 项目隐私记忆与本地配置

## 5. 已知坑与标准流程

1. **远程有 GitHub 自动生成的占位 README（仅 1 文件）会导致本地分叉**
   - 报错：`! [rejected] main -> main (fetch first)`。
   - ❌ 不要用 `git rebase --root origin/main`：该命令会把根提交本身当边界跳过，导致本地提交丢失、HEAD 快进到远程占位。
   - ✅ 正确做法：在远程 base 上重建线性提交——
     ```bash
     git checkout -B publish <远程base提交>
     git checkout <本地根提交> -- .
     git add -A
     git commit -m "..."      # 用 §2 的 noreply 邮箱
     git push ... publish:main
     ```

2. **GH007：push would publish a private email address**
   - 触发条件：提交作者邮箱是真实私有邮箱（如 qq 邮箱），且账号开了「Block command line pushes that expose my email」。
   - ✅ 修法：提交邮箱改为 §2 的 noreply 地址即可通过。

3. **贡献归属**
   - 用 noreply 提交后，贡献已计入 `hanyuestar` 名下，无需改用真实邮箱。
   - 若坚持要在 commit 中显示真实邮箱，需先在 GitHub 网页端关闭 `Block command line pushes that expose my email`（该开关是账号级、token 无权限改），再重建提交重推。

## 6. 一键回归测试（推送前建议先跑）

```bash
npm test        # 聚合运行 test_tarot.js(55) + test_all.js(117)，共 172 项断言
```
