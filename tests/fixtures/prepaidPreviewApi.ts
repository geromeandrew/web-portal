import { createPrepaidFixture } from "./prepaidFixture";
const screen =
  new URLSearchParams(window.location.search).get("screen") ?? "review";
export const fixture = createPrepaidFixture(screen);
export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const apiRequest = fixture.request;
export const getAccessTokenForRequest = async () => null;
export const renewAccessToken = async () => null;
export const downloadApiFile = async () => undefined;
// Isolated preview transport only. This file is never imported by production.
if (screen === "upload") {
  class PreviewXHR {
    upload: { onprogress?: (e: unknown) => void } = {};
    onload?: () => void;
    onabort?: () => void;
    status = 200;
    responseText = "{}";
    timer?: ReturnType<typeof setTimeout>;
    open() {}
    setRequestHeader() {}
    send(form: FormData) {
      const file = form.get("file") as File;
      setTimeout(
        () =>
          this.upload.onprogress?.({
            lengthComputable: true,
            loaded: 25,
            total: 100,
          }),
        100,
      );
      this.timer = setTimeout(() => {
        fixture.sources.files.push({
          id: "uploaded-file",
          source_code: "ke24",
          original_name: file.name,
        });
        this.onload?.();
      }, 20000);
    }
    abort() {
      clearTimeout(this.timer);
      this.onabort?.();
    }
  }
  window.XMLHttpRequest = PreviewXHR as unknown as typeof XMLHttpRequest;
}
