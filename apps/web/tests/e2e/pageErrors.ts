export function collectRelevantPageErrors(page: {
  on(event: "pageerror", handler: (error: Error) => void): void;
}) {
  const pageErrors: string[] = [];

  page.on("pageerror", (error) => {
    if (isKnownNoisyPageError(error)) {
      return;
    }

    pageErrors.push(error.message);
  });

  return pageErrors;
}

function isKnownNoisyPageError(error: Error) {
  return error.name === "SyntaxError" && error.message === "Invalid or unexpected token" && !error.stack;
}
