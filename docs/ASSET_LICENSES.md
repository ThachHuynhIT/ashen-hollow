# Ashen Hollow — Asset License Policy

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

## 5. Public GitHub Rule

Asset commit vào public GitHub được xem là redistribution.

```text
CC0
→ OK

CC-BY
→ OK + attribution

No redistribution
→ NOT OK unless explicit permission / compatible distribution architecture
```

## 6. Attribution

CC-BY entry phải ghi:

- creator;
- source;
- license;
- modification note nếu có.

Đặt tại:

```text
CREDITS.md
docs/licenses/
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

`source → license → redistribution → attribution → manifest → credits`
