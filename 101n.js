const express = require('express');
const PDFDocument = require('pdfkit');
const fs = require('fs');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post('/generate-pdf', (req, res) => {
    const data = req.body;
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const filename = 'generated-document.pdf';

    res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    generatePDF(doc, data);

    doc.end();
});

function generatePDF(doc, data) {
    let currentPage = 1;
    const totalPages = Math.ceil(data.processors.length / 2); // Estimate pages based on processors

    // Add initial page elements
    addPageElements(doc, data.document_header, currentPage, totalPages);

    data.processors.forEach((processor, index) => {
        if (doc.y > 700) {
            doc.addPage();
            currentPage++;
            addPageElements(doc, data.document_header, currentPage, totalPages);
        }
        
        // Processor Heading
        doc.font('Helvetica-Bold').fontSize(15).fillColor('red').text(processor.heading, 30, doc.y, { align: 'left' });
        doc.moveDown();

        // Criteria
        printSection(doc, processor.criteria);

        // Processor Information
        printSection(doc, processor.processorInformation);

        // Farmer Information
        printSection(doc, processor.farmerInformation);

        // Contract Line Details
        printTable(doc, processor.contractLineDetails);

        // Farmer Comments
        printSection(doc, processor.farmerComments);

        doc.moveDown();
    });

    // Additional Information
    if (doc.y > 700) {
        doc.addPage();
        currentPage++;
        addPageElements(doc, data.document_header, currentPage, totalPages);
    }
    printAdditionalInfo(doc, data.additionalInfo);
}

function addPageElements(doc, header, pageNumber, totalPages) {
    // Add logo
    doc.image('sapCompanyLogo.png', 30, 30, { width: 50 });

    // Add header
    doc.font('Helvetica-Bold').fontSize(14).text(header, 0, 40, { align: 'center' });

    // Add page number
    doc.font('Helvetica').fontSize(10).text(`Page ${pageNumber} of ${totalPages}`, 500, 780);

    // Set the Y position to start content below the header
    doc.y = 100;
}

function printSection(doc, section) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text(section.sectionHeading, 30, doc.y, { align: 'left', underline: true });
    doc.moveDown(0.5);

    const fields = Object.entries(section).filter(([key]) => key !== 'sectionHeading');
    const columnWidth = 180;
    const startX = 30;

    for (let i = 0; i < fields.length; i += 3) {
        const row = fields.slice(i, i + 3);
        let maxLabelHeight = 0;
        let maxValueHeight = 0;

        // Calculate max heights for this row
        row.forEach(([, field]) => {
            const labelHeight = doc.heightOfString(field.label, { width: columnWidth - 10 });
            const valueHeight = doc.heightOfString(field.value.toString(), { width: columnWidth - 10 });
            maxLabelHeight = Math.max(maxLabelHeight, labelHeight);
            maxValueHeight = Math.max(maxValueHeight, valueHeight);
        });

        // Print labels
        const labelY = doc.y;
        row.forEach(([, field], index) => {
            const x = startX + (index * columnWidth);
            doc.font('Helvetica-Bold').fontSize(9).text(field.label, x, labelY, { width: columnWidth - 10 });
        });

        // Move to next line for values with minimal spacing
        doc.moveDown(0.3);

        // Print values
        const valueY = doc.y;
        row.forEach(([, field], index) => {
            const x = startX + (index * columnWidth);
            doc.font('Helvetica').fontSize(10).text(field.value.toString(), x, valueY, { width: columnWidth - 10 });
        });

        // Move to next line for the next set of fields
        doc.moveDown(0.7);
    }
    doc.moveDown(0.5);
}

function printTable(doc, tableData) {
    doc.font('Helvetica-Bold').fontSize(11).text(tableData.sectionHeading, 30, doc.y, { align: 'left', underline: true });
    doc.moveDown(0.5);

    const headers = Object.values(tableData.columnHeader);
    const rows = tableData.rows.map(row => Object.values(row));
    
    const tableWidth = 500; // Adjust as needed
    const cellPadding = 5;
    const cellWidth = tableWidth / headers.length;
    const minRowHeight = 20;

    let yPosition = doc.y;

    // Calculate header height
    let headerHeight = minRowHeight;
    headers.forEach(header => {
        const headerLines = doc.heightOfString(header, {
            width: cellWidth - (2 * cellPadding),
            align: 'left'
        });
        headerHeight = Math.max(headerHeight, headerLines + 2 * cellPadding);
    });

    // Draw header with background color
    doc.fillColor('#083446').rect(30, yPosition, tableWidth, headerHeight).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(10);
    headers.forEach((header, i) => {
        doc.text(header, 30 + (i * cellWidth) + cellPadding, yPosition + cellPadding, {
            width: cellWidth - (2 * cellPadding),
            align: 'left'
        });
    });

    yPosition += headerHeight;

    // Draw rows
    doc.fillColor('black').font('Helvetica').fontSize(10); // Reset text color and font for rows
    rows.forEach((row, rowIndex) => {
        let rowHeight = minRowHeight;
        // Calculate row height
        row.forEach((cell, i) => {
            const cellLines = doc.heightOfString(cell.toString(), {
                width: cellWidth - (2 * cellPadding),
                align: 'left'
            });
            rowHeight = Math.max(rowHeight, cellLines + 2 * cellPadding);
        });

        // Draw cells
        row.forEach((cell, i) => {
            doc.text(cell.toString(), 30 + (i * cellWidth) + cellPadding, yPosition + cellPadding, {
                width: cellWidth - (2 * cellPadding),
                align: 'left'
            });
        });
        yPosition += rowHeight;
    });

    doc.y = yPosition + 10; // Move the cursor below the table
    doc.moveDown();
}

function printAdditionalInfo(doc, additionalInfo) {
    doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text(additionalInfo.sectionHeading, 30, doc.y, { align: 'left' });
    doc.moveDown();

    const fields = Object.entries(additionalInfo).filter(([key]) => key !== 'sectionHeading');
    const maxLabelWidth = Math.max(...fields.map(([, field]) => doc.widthOfString(field.label)));

    fields.forEach(([, field]) => {
        printRadioField(doc, field, maxLabelWidth);
    });
}

function printRadioField(doc, field, maxLabelWidth) {
    const radius = 3;
    const startX = 30;
    const endX = 500;
    const y = doc.y + 7;

    // Print label
    doc.font('Helvetica').fontSize(10).text(field.label, startX, y - 5, { width: maxLabelWidth });

    // Calculate radio button position
    const radioX = endX - 20;

    // Draw radio button
    doc.circle(radioX, y, radius).stroke();
    if (field.value === true) {
        doc.circle(radioX, y, radius - 1).fill();
    }

    doc.moveDown();
}

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});