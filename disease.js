const express = require('express');
const PDFDocument = require('pdfkit');
const fs = require('fs');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post('/generate-pdf', (req, res) => {
    const data = req.body;
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const filename = 'disease-mortality-report.pdf';

    res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    generateMortalityReportPDF(doc, data);

    doc.end();
});

function generateMortalityReportPDF(doc, data) {
    // We'll track the current page as we go
    let currentPage = 1;
    
    // Add page elements for the first page
    addPageElements(doc, data.document_header, currentPage);

    // Generate Mortality Section
    if (data.mortality) {
        printKeyValueSection(doc, data.mortality, data.mortality.sectionHeading);
    }

    // Generate Affected Area Section
    if (data.affectedArea) {
        // Only add a new page if we're close to the bottom
        if (doc.y > 650) {
            doc.addPage();
            currentPage++;
            addPageElements(doc, data.document_header, currentPage);
        }
        printKeyValueSection(doc, data.affectedArea, "Affected Area Details");
    }

    // Generate Complaint and Action Table
    if (data.complaintAndActionTaken) {
        // Only add a new page if we're close to the bottom
        if (doc.y > 650) {
            doc.addPage();
            currentPage++;
            addPageElements(doc, data.document_header, currentPage);
        }
        printTable(doc, data.complaintAndActionTaken);
    }

    // Generate Vet Information
    if (data.vetInformation) {
        // Only add a new page if we're close to the bottom
        if (doc.y > 650) {
            doc.addPage();
            currentPage++;
            addPageElements(doc, data.document_header, currentPage);
        }
        printVetInformationSection(doc, data.vetInformation);
    }

    // Generate Documents Table
    if (data.documents) {
        // Only add a new page if we're close to the bottom
        if (doc.y > 650) {
            doc.addPage();
            currentPage++;
            addPageElements(doc, data.document_header, currentPage);
        }
        printTable(doc, data.documents);
    }
}


function addPageElements(doc, header, pageNumber) {
    // Add logo if available
    try {
        doc.image('sapCompanyLogo.png', 30, 30, { width: 50 });
    } catch (error) {
        console.log('Logo not found, skipping...');
    }

    // Add header
    doc.font('Helvetica-Bold').fontSize(14).text(header, 0, 40, { align: 'center' });

    // Add just the current page number
    doc.font('Helvetica').fontSize(10).text(`Page ${pageNumber}`, 500, 780);

    // Set the Y position to start content below the header
    doc.y = 100;
}

function printKeyValueSection(doc, section, sectionTitle) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text(sectionTitle, 30, doc.y, { align: 'left', underline: true });
    doc.moveDown(0.5);

    const fields = Object.entries(section).filter(([key]) => 
        key !== 'sectionHeading' && typeof section[key] === 'object' && section[key] !== null && 'label' in section[key]);
    
    const columnWidth = 250;
    const startX = 30;

    for (let i = 0; i < fields.length; i += 2) {
        const row = fields.slice(i, i + 2);
        
        // Print labels and values side by side
        const labelY = doc.y;
        row.forEach(([, field], index) => {
            const x = startX + (index * columnWidth);
            doc.font('Helvetica-Bold').fontSize(9).text(field.label, x, labelY);
            doc.font('Helvetica').fontSize(10).text(field.value.toString(), x, labelY + 15);
        });

        // Move to next line
        doc.moveDown(1.5);
    }

    // Check for and print any additional text fields
    const textFields = Object.entries(section).filter(([key, value]) => 
        key !== 'sectionHeading' && typeof value === 'string');
    
    textFields.forEach(([key, value]) => {
        doc.font('Helvetica-Bold').fontSize(10).text(key, 30, doc.y);
        doc.font('Helvetica').fontSize(10).text(value, 30, doc.y + 15, { width: 530 });
        doc.moveDown(1.5);
    });

    doc.moveDown(0.5);
}

function printTable(doc, tableData) {
    // Use sectionHeading if available, or a default title
    const title = tableData.sectionHeading || "Table Data";
    doc.font('Helvetica-Bold').fontSize(11).text(title, 30, doc.y, { align: 'left', underline: true });
    doc.moveDown(0.5);

    const headers = Object.values(tableData.columnHeader);
    const rows = tableData.rows.map(row => Object.values(row));
    
    const tableWidth = 530; // Adjust as needed for full width
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
            const cellContent = cell ? cell.toString() : '';
            const cellLines = doc.heightOfString(cellContent, {
                width: cellWidth - (2 * cellPadding),
                align: 'left'
            });
            rowHeight = Math.max(rowHeight, cellLines + 2 * cellPadding);
        });

        // Draw alternating row background
        if (rowIndex % 2 === 0) {
            doc.fillColor('#f2f2f2').rect(30, yPosition, tableWidth, rowHeight).fill();
        }
        doc.fillColor('black'); // Reset to black text

        // Draw cells
        row.forEach((cell, i) => {
            const cellContent = cell ? cell.toString() : '';
            doc.text(cellContent, 30 + (i * cellWidth) + cellPadding, yPosition + cellPadding, {
                width: cellWidth - (2 * cellPadding),
                align: 'left'
            });
        });
        yPosition += rowHeight;
    });

    doc.y = yPosition + 10; // Move the cursor below the table
    doc.moveDown();
}

function printVetInformationSection(doc, vetInfo) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text(vetInfo.sectionHeading || "Veterinary Information", 30, doc.y, { align: 'left', underline: true });
    doc.moveDown(0.5);

    // Print regular fields
    const fields = Object.entries(vetInfo)
        .filter(([key, value]) => 
            key !== 'sectionHeading' && 
            typeof value === 'object' && value !== null && 
            'label' in value && 'value' in value);
    
    fields.forEach(([, field]) => {
        doc.font('Helvetica-Bold').fontSize(9).text(field.label, 30, doc.y);
        doc.font('Helvetica').fontSize(10).text(field.value.toString(), 30, doc.y + 15);
        doc.moveDown(1.5);
    });

    // Print radio button options in a more streamlined layout
    const radioFields = Object.entries(vetInfo)
        .filter(([key, value]) => 
            key !== 'sectionHeading' && 
            typeof value === 'object' && value !== null && 
            'name' in value && 'options' in value && 'selected' in value);
    
    if (radioFields.length > 0) {
        // Print each radio button row
        radioFields.forEach(([, field]) => {
            const rowY = doc.y;
            
            // Print the question/name
            doc.font('Helvetica').fontSize(10);
            doc.text(field.name, 30, rowY, { width: 350 });
            
            // Calculate row height based on text height
            const textHeight = doc.heightOfString(field.name, { width: 350 });
            const rowHeight = Math.max(20, textHeight); // Min height of 20
            
            // Get the options
            const optionKeys = Object.keys(field.options);
            
            // Calculate the vertical center of the row for alignment
            const verticalCenter = rowY + (rowHeight / 2);
            
            // Draw the radio buttons with yes/no text
            let optionX = 400; // Starting position for first option
            
            optionKeys.forEach((key) => {
                const isSelected = field.selected === key;
                const labelText = field.options[key]; // "Yes" or "No" text
                
                // Draw radio button at the vertical center
                doc.circle(optionX, verticalCenter, 4).stroke();
                if (isSelected) {
                    doc.circle(optionX, verticalCenter, 2).fill();
                }
                
                // Calculate text position to vertically align with radio button center
                // The fontSize/4 adjustment helps center the text with the radio button
                const textY = verticalCenter - doc.currentLineHeight() / 2;
                
                // Draw option text right after the radio button, aligned with its center
                doc.text(labelText, optionX + 10, textY);
                
                optionX += 60; // Move to next option position
            });
            
            // Move to position for next row
            doc.y = rowY + rowHeight + 5;
        });
    }

    doc.moveDown();
}

// Add the flock placement endpoint from the previous example
app.post('/generate-pdf', (req, res) => {
    const data = req.body;
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const filename = 'flock-report.pdf';

    res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    // Check the document_header to determine which type of report to generate
    if (data.document_header.includes("Disease") || data.document_header.includes("Mortality")) {
        generateMortalityReportPDF(doc, data);
    } else {
        generateFlockPDF(doc, data); // The function from the previous code
    }

    doc.end();
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Include the generateFlockPDF function from the previous example here
function generateFlockPDF(doc, data) {
    let currentPage = 1;
    const totalPages = 1;

    // Add initial page elements
    addPageElements(doc, data.document_header, currentPage, totalPages);

    // Generate Flock Placement Table
    if (data.flockPlacement) {
        printTable(doc, data.flockPlacement);
    }

    // Generate Hatchery and Chick Info
    if (data.hatcheryandChickInfo) {
        printKeyValueSection(doc, data.hatcheryandChickInfo, "Hatchery and Chick Information");
    }

    // Check if we need a new page
    if (doc.y > 700) {
        doc.addPage();
        currentPage++;
        addPageElements(doc, data.document_header, currentPage, totalPages);
    }

    // Generate Vaccine and Medication Table
    if (data.vaccineAndMedication) {
        printTable(doc, data.vaccineAndMedication);
    }

    // Generate Summary Section
    if (data.summary) {
        printSummarySection(doc, data.summary);
    }
}

// Include the printSummarySection function from the previous example
function printSummarySection(doc, summary) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text(summary.sectionHeading || "Summary", 30, doc.y, { align: 'left', underline: true });
    doc.moveDown(0.5);

    // Print regular fields
    const fields = Object.entries(summary)
        .filter(([key, value]) => 
            typeof value === 'object' && value !== null && 
            'label' in value && 'value' in value);
    
    const columnWidth = 250;
    const startX = 30;

    for (let i = 0; i < fields.length; i += 2) {
        const row = fields.slice(i, i + 2);
        
        // Print labels and values
        const labelY = doc.y;
        row.forEach(([, field], index) => {
            const x = startX + (index * columnWidth);
            doc.font('Helvetica-Bold').fontSize(9).text(field.label, x, labelY);
            doc.font('Helvetica').fontSize(10).text(field.value.toString(), x, labelY + 15);
        });

        // Move to next line
        doc.moveDown(1.5);
    }

    // Print delivery notes if available
    if (summary.deliveryNotes) {
        doc.font('Helvetica-Bold').fontSize(10).text(summary.deliveryNotes.name, 30, doc.y);
        doc.moveDown(0.5);

        // Draw radio buttons for options
        const options = summary.deliveryNotes.options;
        const selected = summary.deliveryNotes.selected;
        
        Object.entries(options).forEach(([key, text], index) => {
            const isSelected = key === selected;
            const x = 40;
            const y = doc.y;
            
            // Draw radio button
            doc.circle(x, y + 5, 4).stroke();
            if (isSelected) {
                doc.circle(x, y + 5, 2).fill();
            }
            
            // Draw option text
            doc.font('Helvetica').fontSize(10).text(text, x + 15, y);
            doc.moveDown(0.5);
        });
    }

    // Print comments if available
    if (summary.comments) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(10).text("Comments:", 30, doc.y);
        doc.moveDown(0.3);
        doc.font('Helvetica').fontSize(10).text(summary.comments, 30, doc.y, { width: 530 });
    }

    doc.moveDown();
}
