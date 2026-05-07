export default function registerHealthRoute(app) {
  app.get("/health", (req, res) => {
    res.json({ ok: true, version: "1.0.0" });
  });
}
