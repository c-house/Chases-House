function Page({ children }) {
  return (
    <div className="rustic" style={pageStyles.page}>
      <div style={pageStyles.inner}>{children}</div>
    </div>
  );
}

const pageStyles = {
  page: {
    minHeight: "100vh",
    background: "var(--paper)",
    backgroundImage: [
      "radial-gradient(at 12% 8%, rgba(184,80,42,0.06) 0, transparent 50%)",
      "radial-gradient(at 88% 92%, rgba(94,107,58,0.07) 0, transparent 50%)",
      "radial-gradient(at 50% 100%, rgba(43,30,20,0.05) 0, transparent 60%)",
    ].join(","),
    color: "var(--ink)",
    fontFamily: "var(--font-body-rustic)",
  },
  inner: { maxWidth: "1080px", margin: "0 auto", padding: "clamp(1.5rem, 4vw, 3rem)" },
};

window.Page = Page;
