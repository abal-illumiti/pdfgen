const express = require('express');
const PDFDocument = require('pdfkit');

const app = express();
const port = 3000;

app.use(express.json());

function createPDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, autoFirstPage: false });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const columnWidths = [400, 100];
    const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    const headers = ['Audit Checkpoint', 'Farmer Notes'];
    let currentPage = 0;

    function addPage() {
      doc.addPage();
      currentPage++;
      doc.fontSize(20).text(`Page ${currentPage}`, { align: 'center' });
      doc.moveDown(0.3);
      drawTableRow(doc, headers, columnWidths, true);
    }

    addPage();

    data.value.forEach((row, index) => {
      if (doc.y > 700) {
        addPage();
      }
      if (row.value === undefined) {
        drawTableRow(doc, [row.description], [totalWidth]);
      } else {
        drawTableRow(doc, [row.description, row.value], columnWidths);
      }
    });

    // Add checkbox before the agreement text
    doc.moveDown(1);
    drawCheckbox(doc, 'I agree', data.agreement.checkbox);

    // Add detailed text from the agreement object, aligned to the table margins
    doc.moveDown(0.5);
    doc.fontSize(12).text(data.agreement.agreement, 
      doc.page.margins.left, // Set left margin to match table
      doc.y, 
      {
        width: totalWidth, // Set width to match table
        align: 'left'
      }
    );

    doc.end();
  });
}

function drawTableRow(doc, row, columnWidths, isHeader = false) {
  const y = doc.y;
  const cellHeights = row.map((cell, i) => {
    return doc.heightOfString(cell, { 
      width: columnWidths[i] - 10,
      lineGap: 0
    });
  });
  const rowHeight = Math.max(...cellHeights) + (isHeader ? 5 : 10); // Less padding for header

  doc.strokeColor('#e5e5e5');

  if (!isHeader) {
    doc.rect(doc.page.margins.left, y, columnWidths.reduce((a, b) => a + b), rowHeight).stroke();
  }

  let x = doc.page.margins.left;
  row.forEach((cell, i) => {
    const columnWidth = columnWidths[i];

    if (!isHeader && i > 0 && row.length > 1) {
      doc.moveTo(x, y)
         .lineTo(x, y + rowHeight)
         .stroke();
    }

    doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(12)
      .fillColor('#083446')
      .text(cell, x + 5, y + (isHeader ? 2 : 5), { // Less top padding for header
        width: columnWidth - 10,
        height: rowHeight - (isHeader ? 4 : 10),
        align: 'left',
        lineGap: 0
      });
    x += columnWidth;
  });

  doc.x = doc.page.margins.left;
  doc.y = y + rowHeight - (isHeader ? 2 : 0); // Reduce space after header
}

function drawCheckbox(doc, text, checked = false) {
  const checkboxSize = 15;
  const margin = 10;
  
  const x = doc.page.margins.left;
  const y = doc.y;

  // Set the border color to #e5e5e5
  doc.strokeColor('#e5e5e5');

  // Draw checkbox
  doc.rect(x, y, checkboxSize, checkboxSize).stroke();

  // If checked, draw the check mark in red
  if (checked) {
    doc.strokeColor('red').lineWidth(2);  // Set color to red and increase line width for visibility
    const checkX = x + 3;
    const checkY = y + 3;
    doc.moveTo(checkX, checkY + 5)
      .lineTo(checkX + 3, checkY + 8)
      .lineTo(checkX + 9, checkY + 2)
      .stroke();
  }

  // Reset the line width for future drawing operations
  doc.lineWidth(1);

  // Draw text
  doc.fontSize(12)
    .fillColor('#083446')  // Text color remains #083446
    .text(text, x + checkboxSize + margin, y + (checkboxSize / 2) - 6, {
      align: 'left'
    });

  // Update the y position
  doc.y = y + checkboxSize + 5;
}

app.post('/generate-pdf', async (req, res) => {
  try {
    const data = req.body;
    const pdfBuffer = await createPDF(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=output.pdf');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'An error occurred while generating the PDF' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});