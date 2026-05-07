function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents || "{}");
    var expectedSecret = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET");

    if (expectedSecret && data.secret !== expectedSecret) {
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    var title = data.title || "AI 网页助手总结";
    var sourceUrl = data.url || "";
    var summary = data.summary || "";

    if (!summary.trim()) {
      return jsonResponse({ ok: false, error: "summary 为空" });
    }

    var doc = DocumentApp.create(title);
    var body = doc.getBody();

    body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING1);

    if (sourceUrl) {
      body.appendParagraph("来源：" + sourceUrl);
    }

    body.appendParagraph("");
    body.appendParagraph(summary);

    doc.saveAndClose();

    return jsonResponse({
      ok: true,
      url: doc.getUrl(),
      documentId: doc.getId()
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
