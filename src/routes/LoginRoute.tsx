import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import loginIllustration from "../assets/login-illustration.png";
import oktaLogo from "../assets/okta-logo.png";

// Keep the page's visual system together so future UI changes do not require
// hunting through shared portal styles.
const loginUi = {
  screen: "grid min-h-screen place-items-center bg-[#f5f9fa] px-6 py-12",
  layout:
    "grid w-full max-w-[332px] gap-10 bg-white lg:h-[361px] lg:w-[876px] lg:max-w-none lg:grid-cols-[332px_544px] lg:gap-0",
  illustration:
    "aspect-[332/361] w-full object-cover object-center lg:h-[361px] lg:w-[332px] lg:aspect-auto",
  brandPanel: "grid place-items-center lg:h-[361px] lg:w-[544px]",
  brandContent: "w-full lg:w-[332px] lg:translate-y-1",
  title:
    "m-0 whitespace-nowrap font-elliot text-[clamp(3.5rem,20vw,5.8125rem)] font-extrabold leading-none tracking-[-0.055em] text-[#244797] lg:-translate-y-[11px] lg:text-[93px]",
  subtitle:
    "mt-1 font-elliot text-[14px] leading-6 text-[#244797] sm:text-base lg:-translate-y-[14px]",
  // Kept as fixed design dimensions, capped at the available mobile width.
  ssoButton:
    "mt-[19px] grid h-[46px] w-full max-w-[305px] grid-cols-[47px_minmax(0,1fr)] overflow-hidden rounded-[6px] border-2 border-[#007ac3] bg-[#087dca] p-0 font-elliot text-[13px] font-medium text-white transition-colors hover:bg-[#0674bb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007ac3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f9fa] disabled:cursor-wait disabled:opacity-70",
  oktaWordmark:
    "grid h-full place-items-center border-r border-[#007ac3] bg-white",
  oktaLogo: "h-auto w-[36px]",
  ssoLabel: "grid h-full place-items-center text-center leading-none",
  error: "mt-3 text-sm leading-5 text-rose-700",
};

function LoginIllustration() {
  return (
    <img
      src={loginIllustration}
      alt="Person using a laptop"
      className={loginUi.illustration}
    />
  );
}

function OktaSsoButton({
  busy,
  onSignIn,
}: {
  busy: boolean;
  onSignIn(): void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onSignIn}
      className={loginUi.ssoButton}
      aria-busy={busy}
    >
      <span className={loginUi.oktaWordmark}>
        <img src={oktaLogo} alt="Okta" className={loginUi.oktaLogo} />
      </span>
      <span className={loginUi.ssoLabel}>
        {busy ? "Redirecting…" : "Log in with OKTA SSO"}
      </span>
    </button>
  );
}

export default function LoginRoute() {
  const { user, login } = useAuth();
  const location = useLocation();
  const callbackError =
    typeof location.state === "object" &&
    location.state &&
    "authError" in location.state &&
    typeof location.state.authError === "string"
      ? location.state.authError
      : null;
  const [error, setError] = useState<string | null>(callbackError);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setError(callbackError);
  }, [callbackError]);

  if (user) return <Navigate to="/" replace />;

  const originalUri =
    typeof location.state === "object" &&
    location.state &&
    "from" in location.state &&
    typeof location.state.from === "string"
      ? location.state.from
      : "/";

  const signIn = async () => {
    setBusy(true);
    setError(null);

    try {
      await login(originalUri);
    } catch {
      setError("Unable to start Okta sign-in. Please try again.");
      setBusy(false);
    }
  };

  return (
    <main className={loginUi.screen}>
      <div className={loginUi.layout}>
        <LoginIllustration />

        <section className={loginUi.brandPanel} aria-labelledby="login-title">
          <div className={loginUi.brandContent}>
            <h1 id="login-title" className={loginUi.title}>
              ES-ATP
            </h1>
            <p className={loginUi.subtitle}>
              Automation and Transformation Platform
            </p>
            <OktaSsoButton busy={busy} onSignIn={() => void signIn()} />
            {error ? (
              <p className={loginUi.error} role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
