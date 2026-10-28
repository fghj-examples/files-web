# files-web

The frontend of the [fghj](https://github.com/mlnja/fghj) `files` example:
a React app behind nginx at `https://files.test`.

- **Login** is an OIDC redirect to Descope with PKCE, back to
  `https://files.test/callback`. That's an `additional_hosts` alias, so the
  callback registered with Descope stays the same whatever your workspace
  directory is called; the derived `web.files-web.<workspace>.fghj.internal`
  name changes with it.
- **Uploads and downloads** go straight to MinIO on presigned URLs from
  `files-api`. nginx proxies `/api/` to the api, so the browser talks to one
  origin.

Flows: `browse` (log in, upload, download — no thumbnails) and `full`
(everything, with the worker and the sample files).

To try it:

```bash
mkdir files && cd files
fghj wire https://github.com/fghj-examples/files-web.git
```

Then open the link it prints, Pull all, start `full`, and open
`https://files.test`.

## The tutorial

This repo is the example the [fghj tutorial](https://fghj.mlops.ninja/tutorial/)
builds, one chapter at a time. Each chapter it appears in is a tag, `ch4`
to `ch7`, and `main` is the finished repo.
