const express = require('express');
//const PDFDocument = require('pdfkit');
const PDFDocument = require('pdfkit-table'); // Change this line
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const logoPath = path.join(__dirname, 'sapCompanyLogo.png'); // Replace with your logo file

function addHeader(doc, headerText, pageNumber) {
  const logoPath = path.join(__dirname, 'sapCompanyLogo.png'); // Ensure this path is correct
  doc.image(logoPath, 50, 20, { width: 40 });
  doc.fontSize(14).text(headerText, 50, 30, { align: 'center', width: doc.page.width - 100 });
  doc.fontSize(10).text(`Page ${pageNumber}`, 500, 30, { align: 'right' });
}

app.post('/generate-pdf', (req, res) => {
  const data = req.body;
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 }
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=document.pdf');

  doc.pipe(res);

  let pageNumber = 1;

  // Add header to the first page
  addHeader(doc, data.document_header, pageNumber);

  // Event listener for new pages
  doc.on('pageAdded', () => {
    pageNumber++;
    addHeader(doc, data.document_header, pageNumber);
  });

  doc.moveDown(2);

  addSection(doc, data.contract_details, 'Contract Details');
  addSection(doc, data.farmerInfo, 'Farmer Information');
  addSection(doc, data.processorInfo, 'Processor Information');
  addQuotaAllocationTable(doc, data.quotaAllocation);
  addSection(doc, data.otherInfo, 'Other Information');
  addAgreement(doc, data.agreement);

  doc.end();
});


function addSection(doc, data, sectionTitle) {
  doc.moveDown(1);
  doc.fontSize(16).fillColor('red').font('Helvetica-Bold').text(sectionTitle, 50, doc.y, { align: 'left', width: 200 });
  doc.moveDown(0.5);

  const fieldsPerRow = 2;
  const fieldWidth = (doc.page.width - 100) / fieldsPerRow;
  const fontSize = 10;
  const rowSpacing = 5;
  const labelValueSpacing = 3;

  let y = doc.y;
  let rowFields = [];
  let rowValues = [];

  Object.entries(data).forEach(([key, field], index) => {
    if (key === 'heading') return;

    rowFields.push(field.label);
    rowValues.push(field.value);

    if (rowFields.length === fieldsPerRow || index === Object.entries(data).length - 1) {
      printRow(doc, rowFields, y, fieldWidth, fontSize, true);
      y += 15;
      printRow(doc, rowValues, y, fieldWidth, fontSize);
      y += 30;
      rowFields = [];
      rowValues = [];

      if (y + 50 > doc.page.height - 50) {
        doc.addPage();
        y = 50;
      }
    }
  });

  doc.moveDown(1);
}

function printRow(doc, row, y, fieldWidth, fontSize, bold = false) {
  row.forEach((field, index) => {
    const fieldX = 50 + index * (fieldWidth + 15);
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? fontSize + 1 : fontSize).fillColor(bold ? '#083446' : 'black').text(field, fieldX, y, { width: fieldWidth, align: 'left', ellipsis: true });
  });
}

// Modify addQuotaAllocationTable to be async
function addQuotaAllocationTable(doc, data) {
  doc.addPage();
  doc.moveDown(3);
  doc.fontSize(14).fillColor('red').font('Helvetica-Bold').text(data.heading, 50, doc.y, { align: 'left', width: 200 });
  doc.moveDown();

  const headers = Object.values(data.columnHeader);
  const rows = data.rows;

  const tableLeft = 50;
  const cellPadding = 3;
  const tableWidth = doc.page.width - 100;
  const cellWidth = tableWidth / headers.length;
  const headerHeight = 40; // Increased to allow for wrapping
  const rowHeight = 20; // Reduced row height

  let tableTop = doc.y;
  let currentTop = tableTop;

  function drawTableHeader() {
    doc.fillColor('#083446').rect(tableLeft, currentTop, tableWidth, headerHeight).fill();
    headers.forEach((header, i) => {
      doc.fillColor('white')
         .font('Helvetica-Bold')
         .fontSize(9)
         .text(header, 
               tableLeft + i * cellWidth + cellPadding, 
               currentTop + cellPadding, 
               { width: cellWidth - 2 * cellPadding, align: 'center', height: headerHeight - 2 * cellPadding });
    });
    currentTop += headerHeight;
  }

  function drawTableRow(row) {
    const values = Object.values(row);
    values.forEach((value, i) => {
      doc.fillColor('black')
         .font('Helvetica')
         .fontSize(8)
         .text(value.toString(), 
               tableLeft + i * cellWidth + cellPadding, 
               currentTop + cellPadding, 
               { width: cellWidth - 2 * cellPadding, align: 'center', height: rowHeight - 2 * cellPadding });
    });
    currentTop += rowHeight;
  }

  function drawTableGrid() {
    doc.rect(tableLeft, tableTop, tableWidth, currentTop - tableTop).stroke();
    for (let i = 1; i < headers.length; i++) {
      doc.moveTo(tableLeft + i * cellWidth, tableTop)
         .lineTo(tableLeft + i * cellWidth, currentTop)
         .stroke();
    }
    doc.moveTo(tableLeft, tableTop + headerHeight)
       .lineTo(tableLeft + tableWidth, tableTop + headerHeight)
       .stroke();
    for (let i = 1; i <= (currentTop - tableTop - headerHeight) / rowHeight; i++) {
      doc.moveTo(tableLeft, tableTop + headerHeight + i * rowHeight)
         .lineTo(tableLeft + tableWidth, tableTop + headerHeight + i * rowHeight)
         .stroke();
    }
  }

  function startNewPage() {
    doc.addPage();
    tableTop = 100; // Start below the logo
    currentTop = tableTop;
    drawTableHeader();
  }

  drawTableHeader();

  rows.forEach((row, rowIndex) => {
    if (currentTop + rowHeight > doc.page.height - 50) {
      drawTableGrid();
      startNewPage();
    }
    drawTableRow(row);
  });

  drawTableGrid();

  doc.y = currentTop + 20;
}


function addAgreement(doc, agreementData) {
  doc.moveDown(2);
  const checkboxSize = 12;
  const checkboxX = 50;
  const checkboxY = doc.y;
  const textX = checkboxX + checkboxSize + 5; // 5 px gap between checkbox and text
  
  // Draw checkbox
  doc.rect(checkboxX, checkboxY, checkboxSize, checkboxSize).stroke();
  
  if (agreementData.checkbox) {
    // Draw a more visible checkmark
    doc.save()
      .moveTo(checkboxX + 2, checkboxY + 6)
      .lineTo(checkboxX + 5, checkboxY + 9)
      .lineTo(checkboxX + 10, checkboxY + 3)
      .lineWidth(2)
      .stroke()
      .restore();
  }
  
  // Add agreement text
  doc.font('Helvetica').fontSize(10).text(agreementData.agreementText, textX, checkboxY + 2, {
    width: doc.page.width - textX - 50,
    align: 'left'
  });
}
  
  app.listen(3000, () => {
    console.log('Server started on port 3000');
  });