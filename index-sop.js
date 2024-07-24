const express = require("express");
const PDFSOPDocument = require("pdfkit-table");
//const PDFDocumentTable = require('pdfkit-table');  // Change this line

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

function createPDF(data) {
  return new Promise((resolve, reject) => {
    const docSOP = new PDFSOPDocument({ margin: 30, autoFirstPage: false });
    const chunks = [];

    docSOP.on("data", (chunk) => chunks.push(chunk));
    docSOP.on("end", () => resolve(Buffer.concat(chunks)));
    docSOP.on("error", reject);

    const pageWidth = 550;
    const leftMargin = 30;
    let currentPage = 0;

    function addPage() {
      docSOP.addPage();
      currentPage++;

      // Add logo to the top left corner
      docSOP.image("./sapCompanyLogo.png", 30, 30, { width: 25, height: 25 });

      // Add "DOCUMENT FOR REVIEW" header
      docSOP.fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#083446')
        .text(data.document_header, 50, 30, { align: 'center' });

      docSOP.fontSize(10).text(`Page ${currentPage}`, { align: "right" });
      docSOP.moveDown(3);
    }

    addPage();

    data.value.forEach((item) => {
      if (docSOP.y > 700) {
        addPage();
      }
      if (item["floorArea"]) {
        drawStockDensityTable(
          docSOP,
          item["floorArea"],
          pageWidth,
          leftMargin
        );
      } else if (item["feeders"]) {
        docSOP.moveDown(1);
        drawStockDensityTable(
          docSOP,
          item["feeders"],
          pageWidth,
          leftMargin
        );
        docSOP.moveDown(1);
      } else {
        drawItem(docSOP, item, pageWidth, leftMargin);
      }
    });

    if (data.agreement) {
      if (docSOP.y + 60 > docSOP.page.height - docSOP.page.margins.bottom) {
        addPage();
      }

      docSOP.moveDown(1);
      // Updated agreement text rendering
      docSOP.font("Helvetica").fontSize(10).fillColor("#083446");
      docSOP.text(data.agreement.agreement, {
        align: "left",
        width: pageWidth - 2 * leftMargin,
        lineGap: 2, // Adjust this value to control space between lines
        paragraphGap: 0, // No extra space between paragraphs
      });

      docSOP.moveDown(1);
      drawCheckbox(docSOP, "I agree", data.agreement.checkbox, leftMargin);
      docSOP.moveDown(1);

      // Add detailed text from the agreement object, aligned to the table margins
      docSOP.fontSize(14)
        .fillColor('#083446')  // Set text color to #083446
        .text(data.signature,
          docSOP.page.margins.left,
          docSOP.y
        );
  
    }

    docSOP.end();
  });
}

function drawItem(docSOP, item, pageWidth, leftMargin) {
  // Determine font size and style based on content
  if (item["description"] === undefined) {
    return;
  }

  let fontSize = 12;
  let fontStyle = "Helvetica";
  let isSpecialRow = false;
  let isBold = false;

  if (item.description.includes("Section")) {
    fontSize = 18;
    fontStyle = "Helvetica-Bold";
    isSpecialRow = true;
  } else if (
    item.description.includes("Subsection") ||
    item.description.includes("Sous-section")
  ) {
    fontSize = 14;
    fontStyle = "Helvetica-Bold";
    isSpecialRow = true;
  }

  // Check if the description starts with "<b>"
  if (item.description.startsWith("<b>")) {
    fontStyle = "Helvetica-Bold";
    isBold = true;
    // Remove the "<b>" from the beginning of the description
    item.description = item.description.substring(3);
  }

  // Draw description
  docSOP.x = leftMargin;
  docSOP.font(fontStyle).fontSize(fontSize).fillColor("#083446");
  docSOP.text(item.description, {
    width: pageWidth - 2 * leftMargin,
    lineGap: 5,
  });

  // Reduce space after all rows
  docSOP.moveDown(0.2); // Reduced space for all rows

  // Handle different types of controls
  if (item.type) {
    docSOP.font("Helvetica").fontSize(10).fillColor("#083446");
    docSOP.x = leftMargin; // Ensure alignment to the left margin
    switch (item.type) {
      case "INPUT":
        const inputWidth = pageWidth - 2 * leftMargin;
        const textHeight = docSOP.heightOfString(item.value || "", {
          width: inputWidth - 10,
        });
        const inputHeight = Math.max(textHeight + 10, 20);
        docSOP
          .strokeColor("#083446")
          .rect(docSOP.x, docSOP.y, inputWidth, inputHeight)
          .stroke();
        docSOP.text(item.value || "", docSOP.x + 5, docSOP.y + 5, {
          width: inputWidth - 10,
        });
        docSOP.moveDown(inputHeight / 12);
        break;
      case "CHECKBOK":
      case "RADIO":
        for (let i = 1; i <= 10; i++) {
          const optionKey = `option${i}`;
          if (item[optionKey]) {
            const optionValue = item[optionKey].value;
            const isChecked = item[optionKey].checked;
            if (item.type === "CHECKBOK") {
              drawCheckbox(docSOP, optionValue, isChecked, leftMargin);
            } else {
              drawRadioButton(docSOP, optionValue, isChecked, leftMargin);
            }
          }
        }
        break;
    }
  }

  // Adjust final spacing based on row type
  if (isSpecialRow) {
    docSOP.moveDown(0.3); // Slightly more space after Section and Subsection
  } else {
    docSOP.moveDown(0.1); // Minimal space after other rows for tighter layout
  }
}

function drawCheckbox(docSOP, label, isChecked, leftMargin) {
  const boxSize = 10;
  const textOffset = 15;
  const lineHeight = 14; // Approximate height of a line of text

  // Check if there's enough space on the current page
  if (docSOP.y + lineHeight > docSOP.page.height - docSOP.page.margins.bottom) {
    docSOP.addPage();
  }

  docSOP.x = leftMargin;
  const startY = docSOP.y;

  // Draw checkbox
  docSOP
    .strokeColor("#083446")
    .rect(docSOP.x, startY, boxSize, boxSize)
    .stroke();

  // Mark checkbox if checked
  if (isChecked) {
    docSOP.save();
    docSOP.strokeColor("red").lineWidth(1.5);
    docSOP
      .moveTo(docSOP.x + 2, startY + 5)
      .lineTo(docSOP.x + 4, startY + 7)
      .lineTo(docSOP.x + 8, startY + 3)
      .stroke();
    docSOP.restore();
  }

  // Draw label
  docSOP.font("Helvetica").fontSize(10).fillColor("#083446");
  docSOP.text(label, docSOP.x + textOffset, startY + 1, {
    lineBreak: false,
    width: 500,
  });

  docSOP.y = Math.max(docSOP.y, startY + boxSize);
  docSOP.moveDown(0.5);
}

function drawRadioButton(docSOP, label, isChecked, leftMargin) {
  const radius = 5;
  const textOffset = 15;
  const lineHeight = 14; // Approximate height of a line of text

  // Check if there's enough space on the current page
  if (docSOP.y + lineHeight > docSOP.page.height - docSOP.page.margins.bottom) {
    docSOP.addPage();
  }

  docSOP.x = leftMargin;
  const startY = docSOP.y;

  // Draw radio button
  docSOP
    .strokeColor("#083446")
    .circle(docSOP.x + radius, startY + radius, radius)
    .stroke();

  // Mark radio button if checked
  if (isChecked) {
    docSOP
      .fillColor("#083446")
      .circle(docSOP.x + radius, startY + radius, radius / 2)
      .fill();
  }

  // Draw label
  docSOP.font("Helvetica").fontSize(10).fillColor("#083446");
  docSOP.text(label, docSOP.x + textOffset, startY + 1, {
    lineBreak: false,
    width: 500,
  });

  docSOP.y = Math.max(docSOP.y, startY + radius * 2);
  docSOP.moveDown(0.5);
}

// Add this new function to draw the Stock Density table
function drawStockDensityTable(docSOP, tableData, pageWidth, leftMargin) {
  if (!tableData || !tableData.columnHeader || !tableData.rows) return;

  const headers = Object.values(tableData.columnHeader);
  const rows = tableData.rows;

  const cellPadding = 2;
  const cellWidth = (pageWidth - 2 * leftMargin) / headers.length;
  const fontSize = 8;
  const headerFontSize = 9;

  // Draw the table heading
  docSOP.font("Helvetica-Bold").fontSize(14).text(tableData.Heading, leftMargin, docSOP.y);
  docSOP.moveDown(0.5);

  let yPosition = docSOP.y;
  let headerDrawnOnThisPage = false;

  function drawCell(text, x, y, width, height, isHeader = false) {
    docSOP.rect(x, y, width, height).stroke();
    if (isHeader) {
      docSOP.fillColor("#083446").rect(x, y, width, height).fill();
      docSOP.fillColor("#FFFFFF");
    } else {
      docSOP.fillColor("#083446");
    }
    docSOP
      .font(isHeader ? "Helvetica-Bold" : "Helvetica")
      .fontSize(isHeader ? headerFontSize : fontSize)
      .text(text, x + cellPadding, y + cellPadding, {
        width: width - 2 * cellPadding,
        height: height - 2 * cellPadding,
        align: "left",
        lineBreak: true,
      });
  }

  // Calculate header height
  let headerHeight = 0;
  headers.forEach((header) => {
    const textHeight = docSOP.heightOfString(header, {
      width: cellWidth - 2 * cellPadding,
      fontSize: headerFontSize,
    });
    headerHeight = Math.max(headerHeight, textHeight + 2 * cellPadding) / 2;
  });

  function drawHeaders() {
    if (!headerDrawnOnThisPage) {
      headers.forEach((header, i) => {
        drawCell(
          header,
          leftMargin + i * cellWidth,
          yPosition,
          cellWidth,
          headerHeight,
          true
        );
      });
      yPosition += headerHeight;
      headerDrawnOnThisPage = true;
    }
  }

  // Initial draw of headers
  drawHeaders();

  // Draw rows
  rows.forEach((row) => {
    let rowHeight = 0;
    headers.forEach((header, index) => {
      const cell = row[`value${index + 1}`];
      const textHeight = docSOP.heightOfString(cell.toString(), {
        width: cellWidth - 2 * cellPadding,
        fontSize: fontSize,
      });
      rowHeight = Math.max(rowHeight, textHeight + 2 * cellPadding);
    });

    // Check if we need to move to a new page
    if (yPosition + rowHeight > docSOP.page.height - docSOP.page.margins.bottom) {
      docSOP.addPage();
      yPosition = docSOP.page.margins.top;
      headerDrawnOnThisPage = false;
      drawHeaders();
    }

    headers.forEach((header, index) => {
      const cell = row[`value${index + 1}`];
      drawCell(
        cell.toString(),
        leftMargin + index * cellWidth,
        yPosition,
        cellWidth,
        rowHeight
      );
    });
    yPosition += rowHeight;
  });

  docSOP.moveDown();
}

app.post("/generate-pdf", async (req, res) => {
  try {
    const data = req.body;
    const pdfBuffer = await createPDF(data);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=output.pdf");
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating PDF:", error);
    res
      .status(500)
      .json({ error: "An error occurred while generating the PDF" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
