# Chín Vương Miện — Asset License Policy

## 1. Purpose

Policy cho người phát triển, Claude Code và Codex khi thêm external asset.

## 2. Allowed by Default

Ưu tiên:

- CC0 / Public Domain;
- CC-BY khi có attribution;
- SIL OFL fonts khi giữ license/copyright theo điều khoản.

## 3. Manual Review Required

- license có điều khoản bổ sung;
- no redistribution / no reposting;
- license mâu thuẫn với usage statement;
- AI-training restriction;
- package không có license file;
- chỉ có license trên store page.

## 4. Reject by Default

Không đưa vào public repo nếu:

- personal use only;
- non-commercial;
- redistribution bị cấm;
- license không rõ;
- quyền sử dụng không xác minh được.

## 5. Redistribution Rule (repo và bản phát hành)

Asset bị phân phối lại ở **hai chỗ**: commit lên GitHub công khai, và đóng gói trong bản game phát hành (web, Tauri, Capacitor, itch.io, Steam). Asset phải hợp lệ ở cả hai; bản game vẫn là redistribution kể cả khi repo private.

```text
CC0
→ OK

CC-BY
→ OK + attribution (CREDITS.md và màn hình credits trong game)

No redistribution
→ NOT OK (repo công khai lẫn bản game) unless explicit written permission
```

Font OFL: được đóng gói cùng game, giữ nguyên file license/copyright trong bản phát hành.

## 6. Attribution

CC-BY entry phải ghi:

- creator;
- source;
- license;
- modification note nếu có.

Đặt tại:

```text
CREDITS.md            (repo)
Màn hình credits      (trong game — bắt buộc cho mọi asset attribution: true)
docs/licenses/        (bằng chứng license)
```

## 7. License Evidence

Khi adopt:

```text
docs/licenses/<asset-name>/
├── license.txt
└── source-page.png
```

Nếu không thể lưu screenshot, lưu text/license URL và ngày kiểm tra.

## 8. AI Restrictions

Nếu asset cấm:

- AI training;
- dataset use;
- image-to-image;
- generative AI reference;

thì không đưa asset vào workflow đó.

## 9. Agent Rule

Claude Code/Codex không được tự động tải và commit external asset chỉ vì tìm thấy URL.

Trước commit phải có:

`source → license → redistribution (repo + bản game) → attribution → assets.manifest.yml → credits`
