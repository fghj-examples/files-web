import type { User } from "oidc-client-ts";
import { useCallback, useEffect, useRef, useState } from "react";
import { Api, type FileItem } from "./api.ts";
import { userManager } from "./auth.ts";

type Session =
  | { state: "loading" }
  | { state: "signed-out"; error?: string }
  | { state: "signed-in"; user: User };

async function restoreSession(): Promise<Session> {
  const um = await userManager();
  if (location.pathname === "/callback") {
    try {
      const user = await um.signinRedirectCallback();
      history.replaceState(null, "", "/");
      return { state: "signed-in", user };
    } catch (err) {
      history.replaceState(null, "", "/");
      return { state: "signed-out", error: (err as Error).message };
    }
  }
  const user = await um.getUser();
  return user && !user.expired
    ? { state: "signed-in", user }
    : { state: "signed-out" };
}

export function App() {
  const [session, setSession] = useState<Session>({ state: "loading" });
  const started = useRef(false);

  useEffect(() => {
    // A code can only be exchanged once; StrictMode would try twice.
    if (started.current) return;
    started.current = true;
    restoreSession().then(setSession, (err) =>
      setSession({ state: "signed-out", error: (err as Error).message }),
    );
  }, []);

  if (session.state === "loading") return <main className="shell" />;
  if (session.state === "signed-out") return <SignIn error={session.error} />;
  return (
    <Locker
      user={session.user}
      onSignOut={async () => {
        const um = await userManager();
        await um.removeUser();
        setSession({ state: "signed-out" });
      }}
    />
  );
}

function SignIn({ error }: { error?: string }) {
  return (
    <main className="shell signin">
      <div className="tag tag-hero">
        <span className="hole" aria-hidden />
        <h1>Files</h1>
        <p>
          A small locker for your files. Sign in, drop something in, and get it
          back from a link that works for five minutes.
        </p>
        <button
          type="button"
          className="primary"
          onClick={async () => (await userManager()).signinRedirect()}
        >
          Sign in with Descope
        </button>
        {error && <p className="error">Sign-in didn't finish: {error}</p>}
      </div>
    </main>
  );
}

function Locker({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const api = useRef(new Api(user.access_token)).current;
  const [files, setFiles] = useState<FileItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const refresh = useCallback(
    () => api.list().then(setFiles, (err) => setError(err.message)),
    [api],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Thumbnails arrive from files-worker in the background.
  const waiting = files?.some((f) => f.contentType.startsWith("image/") && !f.thumbUrl);
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [waiting, refresh]);

  async function upload(list: FileList | null) {
    if (!list) return;
    setError(null);
    for (const file of Array.from(list)) {
      setUploading((u) => [...u, file.name]);
      try {
        await api.upload(file);
      } catch (err) {
        setError(`${file.name} wasn't uploaded: ${(err as Error).message}`);
      } finally {
        setUploading((u) => u.filter((n) => n !== file.name));
      }
    }
    await refresh();
  }

  const name = (user.profile.name ?? user.profile.email ?? "you") as string;
  const mine = files?.filter((f) => !f.sample) ?? [];
  const samples = files?.filter((f) => f.sample) ?? [];

  return (
    <main className="shell">
      <header className="top">
        <h1>Files</h1>
        <div className="who">
          <span>{name}</span>
          <button type="button" className="quiet" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <label
        className={`drop ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files);
        }}
      >
        <input type="file" multiple onChange={(e) => upload(e.target.files)} />
        <strong>Drop files here, or choose them</strong>
        <span>
          {uploading.length
            ? `Uploading ${uploading.join(", ")}`
            : "They go straight to storage; images get a thumbnail."}
        </span>
      </label>

      {error && <p className="error">{error}</p>}

      <section>
        <h2>Yours</h2>
        {files && mine.length === 0 && (
          <p className="empty">Nothing here yet. Upload a file to see it in this list.</p>
        )}
        <Tags files={mine} />
      </section>

      {samples.length > 0 && (
        <section>
          <h2>Samples</h2>
          <p className="hint">Put here by the seed in files-api, for everyone.</p>
          <Tags files={samples} />
        </section>
      )}
    </main>
  );
}

function Tags({ files }: { files: FileItem[] }) {
  return (
    <ul className="tags">
      {files.map((f) => (
        <li key={f.id} className="tag">
          <span className="hole" aria-hidden />
          <div className="window">
            {f.thumbUrl ? (
              <img src={f.thumbUrl} alt="" />
            ) : (
              <span className="kind">
                {f.contentType.startsWith("image/") ? "Making thumbnail…" : extension(f.name)}
              </span>
            )}
          </div>
          <h3 title={f.name}>{f.name}</h3>
          <p className="meta">{size(f.size)}</p>
          <a className="download" href={f.downloadUrl}>
            Download
          </a>
          <p className="host" title={f.downloadUrl}>
            from {new URL(f.downloadUrl).host}
          </p>
        </li>
      ))}
    </ul>
  );
}

function extension(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "file";
}

function size(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
