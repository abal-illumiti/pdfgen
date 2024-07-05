const express = require('express');
const PDFDocument = require('pdfkit');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

function createPDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, autoFirstPage: false });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = 550;
    const leftMargin = 30;
    let currentPage = 0;

    function addPage() {
      doc.addPage();
      currentPage++;
      doc.fontSize(20).text(`Page ${currentPage}`, { align: 'center' });
      doc.moveDown();
    }

    addPage();

    data.value.forEach((item) => {
      if (doc.y > 700) {
        addPage();
      }
      
      drawItem(doc, item, pageWidth, leftMargin);
    });

    if (data.agreement) {
      if (doc.y + 60 > doc.page.height - doc.page.margins.bottom) {
        addPage();
      }

      doc.moveDown(3);
      drawCheckbox(doc, 'I agree', data.agreement.checkbox, leftMargin);
      doc.moveDown(2);
      doc.fontSize(12).text(data.agreement.agreement, { align: 'left', width: pageWidth - 2 * leftMargin });
    }

    doc.end();
  });
}

function drawItem(doc, item, pageWidth, leftMargin) {
  // Draw description
  doc.x = leftMargin;
  doc.font('Helvetica-Bold').fontSize(12);
  doc.text(item.description, { width: pageWidth - 2 * leftMargin, lineGap: 5 });
  doc.moveDown(0.5);

  // Handle different types of controls
  if (item.type) {
    doc.font('Helvetica').fontSize(10);
    doc.x = leftMargin;  // Ensure alignment to the left margin
    switch (item.type) {
      case 'INPUT':
        const inputWidth = pageWidth - 2 * leftMargin;
        const textHeight = doc.heightOfString(item.value || '', { width: inputWidth - 10 });
        const inputHeight = Math.max(textHeight + 10, 20);
        doc.rect(doc.x, doc.y, inputWidth, inputHeight).stroke();
        doc.text(item.value || '', doc.x + 5, doc.y + 5, { width: inputWidth - 10 });
        doc.moveDown(inputHeight / 12);
        break;
      case 'CHECKBOK':
      case 'RADIO':
        for (let i = 1; i <= 10; i++) {
          const optionKey = `option${i}`;
          if (item[optionKey]) {
            const optionValue = item[optionKey].value;
            const isChecked = item[optionKey].checked;
            if (item.type === 'CHECKBOK') {
              drawCheckbox(doc, optionValue, isChecked, leftMargin);
            } else {
              drawRadioButton(doc, optionValue, isChecked, leftMargin);
            }
          }
        }
        break;
    }
  }

  doc.moveDown();
}

function drawCheckbox(doc, label, isChecked, leftMargin) {
  doc.x = leftMargin;
  const boxSize = 10;
  const textOffset = 15;

  // Draw checkbox
  doc.rect(doc.x, doc.y, boxSize, boxSize).stroke();

  // Mark checkbox if checked
  if (isChecked) {
    doc.save();
    doc.lineWidth(1.5);
    doc.moveTo(doc.x + 2, doc.y + 5)
       .lineTo(doc.x + 4, doc.y + 7)
       .lineTo(doc.x + 8, doc.y + 3)
       .stroke();
    doc.restore();
  }

  // Draw label
  doc.font('Helvetica').fontSize(10);
  doc.text(label, doc.x + textOffset, doc.y + 1, {
    lineBreak: false,
    width: 500  // Adjust this value as needed
  });

  doc.moveDown();
}

function drawRadioButton(doc, label, isChecked, leftMargin) {
  doc.x = leftMargin;
  const radius = 5;
  const textOffset = 15;

  // Draw radio button
  doc.circle(doc.x + radius, doc.y + radius, radius).stroke();

  // Mark radio button if checked
  if (isChecked) {
    doc.circle(doc.x + radius, doc.y + radius, radius / 2).fill();
  }

  // Draw label
  doc.font('Helvetica').fontSize(10);
  doc.text(label, doc.x + textOffset, doc.y + 1, {
    lineBreak: false,
    width: 500  // Adjust this value as needed
  });

  doc.moveDown();
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
