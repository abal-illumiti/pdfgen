const express = require('express');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const logoPath = path.join(__dirname, 'sapCompanyLogo.png');

app.post('/generate-pdf', (req, res) => {
  const data = req.body;
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 }
  });

  // Set up the response
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=document.pdf');

  // Pipe the PDF to the response
  doc.pipe(res);

  let pageNumber = 1;

  // Add header and page number to each page
  doc.on('pageAdded', () => {
    addHeader(doc, data.document_header, pageNumber++);
  });

  // Add initial header
  addHeader(doc, data.document_header, pageNumber);

  // Add sections
  addContractDetails(doc, data.contract_details);
  addFarmerInfo(doc, data.farmerInfo);
  addProcessorInfo(doc, data.processorInfo);
  addOtherInfo(doc, data.otherInfo);
  addQuotaAllocationTable(doc, data.quotaAllocation);

  // Add agreement
  if (data.agreement && data.agreement.checkbox) {
    doc.moveDown();
    doc.fontSize(12).text(data.agreement.agreement);
  }

  // Finalize the PDF and end the stream
  doc.end();
});

function addHeader(doc, headerText, pageNumber) {
  doc.image(logoPath, 50, 20, { width: 40 });
  
  // Center the document header and increase font size
  doc.fontSize(14).text(headerText, 50, 30, {
    align: 'center',
    width: doc.page.width - 100
  });
  
  doc.fontSize(10).text(`Page ${pageNumber}`, 500, 30, { align: 'right' });
  doc.moveDown(3);
}

function addSection(doc, data, sectionTitle, fieldsPerRow) {
  doc.moveDown(1);
  
  doc.fontSize(16).fillColor('red').font('Helvetica-Bold').text(sectionTitle, 50, doc.y, { align: 'left', width: 200 });
  
  doc.fillColor('black').font('Helvetica');
  doc.moveDown(0.5);

  const pageWidth = doc.page.width - 100; // Account for margins
  const fieldWidth = (pageWidth - (fieldsPerRow - 1) * 15) / fieldsPerRow; // 15 is column spacing
  const fontSize = 10; // Same font size for labels and values
  const rowSpacing = 3;
  const labelValueSpacing = 1; // Consistent spacing between label and value

  let y = doc.y;
  let rowFields = [];

  Object.entries(data).forEach(([key, field], index) => {
    if (key === 'heading') return; // Skip the heading field

    rowFields.push(field);

    if (rowFields.length === fieldsPerRow || index === Object.entries(data).length - 1) {
      // Process the row
      const maxLabelHeight = Math.max(...rowFields.map(f => 
        doc.heightOfString(f.label, { width: fieldWidth, align: 'left', fontSize: fontSize })
      ));

      rowFields.forEach((f, i) => {
        const fieldX = 50 + i * (fieldWidth + 15);
        
        // Draw label
        doc.font('Helvetica-Bold')
           .fontSize(fontSize)
           .fillColor('#083446')
           .text(f.label, fieldX, y, { width: fieldWidth, align: 'left' });

        // Draw value box
        const boxY = y + maxLabelHeight + labelValueSpacing;
        doc.rect(fieldX, boxY, fieldWidth, 20).lineWidth(0.5).stroke('gray');
        
        // Draw value
        doc.font('Helvetica')
           .fontSize(fontSize)
           .fillColor('black')
           .text(f.value, fieldX + 5, boxY + 4, { width: fieldWidth - 10 });
      });

      // Move to next row
      y += maxLabelHeight + 20 + labelValueSpacing + rowSpacing;
      rowFields = [];

      // Check if we're near the bottom of the page
      if (y + 50 > doc.page.height - 50) {
        doc.addPage();
        y = 50; // Reset y to top of new page
      }
    }
  });

  doc.moveDown(1);
}

function addContractDetails(doc, data) {
  addSection(doc, data, data.heading, 3);
}

function addFarmerInfo(doc, data) {
  addSection(doc, data, "Farmer Information", 3);
}

function addProcessorInfo(doc, data) {
  addSection(doc, data, "Processor Information", 4);
}

function addOtherInfo(doc, data) {
  addSection(doc, data, "Other Information", 4);
}

function addQuotaAllocationTable(doc, data) {
  doc.moveDown();
  doc.fontSize(14).fillColor('red').text(data.Heading, { underline: true });
  doc.moveDown();

  const tableTop = doc.y;
  const tableLeft = 50;
  const cellPadding = 5;
  const cellWidth = 80;
  const cellHeight = 20;

  // Draw table headers
  Object.values(data.columnHeader).forEach((header, index) => {
    doc.rect(tableLeft + index * cellWidth, tableTop, cellWidth, cellHeight).stroke();
    doc.fontSize(8).fillColor('black').text(header, tableLeft + index * cellWidth + cellPadding, tableTop + cellPadding, {
      width: cellWidth - 2 * cellPadding,
      align: 'center'
    });
  });

  // Draw table rows
  data.rows.forEach((row, rowIndex) => {
    const y = tableTop + (rowIndex + 1) * cellHeight;
    Object.values(row).forEach((value, columnIndex) => {
      doc.rect(tableLeft + columnIndex * cellWidth, y, cellWidth, cellHeight).stroke();
      doc.fontSize(8).text(value, tableLeft + columnIndex * cellWidth + cellPadding, y + cellPadding, {
        width: cellWidth - 2 * cellPadding,
        align: 'center'
      });
    });
  });

  doc.moveDown(4);
}

const port = 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});