const form = document.getElementById("cover-form");
const printBtn = document.getElementById("printBtn");
const resetBtn = document.getElementById("resetBtn");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const mergePdfBtn = document.getElementById("mergePdfBtn");
const appendPdfInput = document.getElementById("appendPdf");

const fields = {
  assignmentName: {
    input: document.getElementById("assignmentName"),
    output: document.getElementById("previewAssignment"),
    fallback: "ASSIGNMENT NAME",
    transform: (value) => value.toUpperCase()
  },
  subject: {
    input: document.getElementById("subject"),
    output: document.getElementById("previewSubject"),
    fallback: "Subject"
  },
  submittedTo: {
    input: document.getElementById("submittedTo"),
    output: document.getElementById("previewSubmittedTo"),
    fallback: "Teacher",
    transform: (value) => value.split(",").map((part) => part.trim()).filter(Boolean).join("\n")
  },
  submittedBy: {
    input: document.getElementById("submittedBy"),
    output: document.getElementById("previewSubmittedBy"),
    fallback: "Student name\nRegister Number\nClass",
    transform: (value) => value.split(",").map((part) => part.trim()).filter(Boolean).join("\n")
  }
};

const formattingState = Object.fromEntries(
  Object.keys(fields).map((fieldName) => [fieldName, { sizeOffset: 0, bold: false, italic: false, underline: false }])
);

function fitTextToBox(element) {
  const min = Number(element.dataset.minSize || 14);
  const max = Number(element.dataset.maxSize || 48);
  element.style.fontSize = `${max}px`;

  while (
    (element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight) &&
    parseFloat(element.style.fontSize) > min
  ) {
    element.style.fontSize = `${parseFloat(element.style.fontSize) - 1}px`;
  }

  return parseFloat(element.style.fontSize);
}

function applyFormatting(fieldName) {
  const state = formattingState[fieldName];
  const { output } = fields[fieldName];
  const min = Number(output.dataset.minSize || 14);
  const max = Number(output.dataset.maxSize || 48);

  const fittedSize = fitTextToBox(output);
  const adjustedSize = Math.min(max + 22, Math.max(min - 10, fittedSize + state.sizeOffset));

  output.style.fontSize = `${adjustedSize}px`;
  output.style.fontWeight = state.bold ? "800" : "400";
  output.style.fontStyle = state.italic ? "italic" : "normal";
  output.style.textDecoration = state.underline ? "underline" : "none";
  output.style.textUnderlineOffset = state.underline ? "0.12em" : "";
}


function triggerFileDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60000);
}

function updatePreview() {
  Object.entries(fields).forEach(([fieldName, { input, output, fallback, transform }]) => {
    const rawValue = input.value.trim() || fallback;
    const value = transform ? transform(rawValue) : rawValue;
    output.textContent = value;
    applyFormatting(fieldName);
  });
}

async function renderCoverPdfArrayBuffer() {
  updatePreview();

  if (!window.html2canvas || !window.jspdf) {
    throw new Error("PDF rendering libraries failed to load");
  }

  const coverPage = document.getElementById("coverPage");

  const captureHost = document.createElement("div");
  captureHost.style.position = "fixed";
  captureHost.style.left = "-10000px";
  captureHost.style.top = "0";
  captureHost.style.background = "#ffffff";
  captureHost.style.padding = "22px";
  captureHost.style.boxSizing = "border-box";

  const clonedCover = coverPage.cloneNode(true);
  clonedCover.style.margin = "0";
  captureHost.appendChild(clonedCover);
  document.body.appendChild(captureHost);

  let canvas;
  try {
    canvas = await window.html2canvas(captureHost, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true
    });
  } finally {
    document.body.removeChild(captureHost);
  }

  const imgData = canvas.toDataURL("image/png");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = 210;
  const pageHeight = 297;
  const safeMargin = 6;
  const maxWidth = pageWidth - safeMargin * 2;
  const maxHeight = pageHeight - safeMargin * 2;

  const imgRatio = canvas.width / canvas.height;
  let renderWidth = maxWidth;
  let renderHeight = renderWidth / imgRatio;

  if (renderHeight > maxHeight) {
    renderHeight = maxHeight;
    renderWidth = renderHeight * imgRatio;
  }

  const x = (pageWidth - renderWidth) / 2;
  const y = (pageHeight - renderHeight) / 2;

  pdf.addImage(imgData, "PNG", x, y, renderWidth, renderHeight, undefined, "FAST");
  return pdf.output("arraybuffer");
}

Object.values(fields).forEach(({ input }) => {
  input.addEventListener("input", updatePreview);
});

document.querySelectorAll(".field-tools").forEach((toolRow) => {
  const fieldName = toolRow.dataset.field;

  toolRow.querySelectorAll(".tool-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      const state = formattingState[fieldName];

      if (action === "increase") state.sizeOffset += 6;
      if (action === "decrease") state.sizeOffset -= 6;
      if (action === "bold") state.bold = !state.bold;
      if (action === "italic") state.italic = !state.italic;
      if (action === "underline") state.underline = !state.underline;

      button.classList.toggle("active", action === "bold" ? state.bold : action === "italic" ? state.italic : action === "underline" ? state.underline : false);
      updatePreview();
    });
  });
});

window.addEventListener("resize", updatePreview);
printBtn.addEventListener("click", () => {
  updatePreview();
  window.print();
});

downloadPdfBtn.addEventListener("click", async () => {
  try {
    const pdfBytes = await renderCoverPdfArrayBuffer();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    triggerFileDownload(blob, "assignment-cover-page.pdf");
  } catch (error) {
    alert("Could not generate PDF. Please try again.");
    console.error(error);
  }
});

mergePdfBtn.addEventListener("click", async () => {
  try {
    const file = appendPdfInput.files && appendPdfInput.files[0];
    if (!file) {
      alert("Please upload a PDF first.");
      return;
    }

    if (!window.PDFLib) {
      alert("PDF merge library failed to load. Please check internet and try again.");
      return;
    }

    const coverPdfBytes = await renderCoverPdfArrayBuffer();
    const uploadedPdfBytes = await file.arrayBuffer();

    const mergedPdf = await window.PDFLib.PDFDocument.create();
    const coverPdf = await window.PDFLib.PDFDocument.load(coverPdfBytes);
    const uploadedPdf = await window.PDFLib.PDFDocument.load(uploadedPdfBytes);

    const coverPages = await mergedPdf.copyPages(coverPdf, coverPdf.getPageIndices());
    coverPages.forEach((page) => mergedPdf.addPage(page));

    const docPages = await mergedPdf.copyPages(uploadedPdf, uploadedPdf.getPageIndices());
    docPages.forEach((page) => mergedPdf.addPage(page));

    const mergedBytes = await mergedPdf.save();
    const mergedBlob = new Blob([mergedBytes], { type: "application/pdf" });
    triggerFileDownload(mergedBlob, "cover-plus-assignment.pdf");
  } catch (error) {
    alert("Could not merge PDFs. Please ensure the uploaded file is a valid PDF.");
    console.error(error);
  }
});

resetBtn.addEventListener("click", () => {
  form.reset();
  Object.values(formattingState).forEach((state) => {
    state.sizeOffset = 0;
    state.bold = false;
    state.italic = false;
    state.underline = false;
  });
  document.querySelectorAll(".tool-btn.active").forEach((button) => button.classList.remove("active"));
  updatePreview();
});

updatePreview();
