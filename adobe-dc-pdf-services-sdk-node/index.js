const PDFServicesSdk = require('@adobe/pdfservices-node-sdk');
const fs = require('fs');
const unzipper = require('unzipper');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Configure your Adobe PDF Services credentials
const clientId = 'client_id';
const clientSecret = 'client_secret';

// Configure input and output paths
const inputPath = 'resources/extractPDFInput.pdf';
const outputZipPath = 'output/ExtractTextTableWithTableStructure.zip';
const outputCsvPath = 'output/ExtractedData.csv';

// Define the column names and their corresponding JSON paths
const columnNames = {
  'Bussiness__City': 'Bussiness.City',
  'Bussiness__Country': 'Bussiness.Country',
  'Bussiness__Description': 'Bussiness.Description',
  'Bussiness__Name': 'Bussiness.Name',
  'Bussiness__StreetAddress': 'Bussiness.StreetAddress',
  'Bussiness__Zipcode': 'Bussiness.Zipcode',
  'Customer__Address__line1': 'Customer.Address.line1',
  'Customer__Address__line2': 'Customer.Address.line2',
  'Customer__Email': 'Customer.Email',
  'Customer__Name': 'Customer.Name',
  'Customer__PhoneNumber': 'Customer.PhoneNumber',
  'Invoice__BillDetails__Name': 'Invoice.BillDetails.Name',
  'Invoice__BillDetails__Quantity': 'Invoice.BillDetails.Quantity',
  'Invoice__BillDetails__Rate': 'Invoice.BillDetails.Rate',
  'Invoice__Description': 'Invoice.Description',
  'Invoice__DueDate': 'Invoice.DueDate',
  'Invoice__IssueDate': 'Invoice.IssueDate',
  'Invoice__Number': 'Invoice.Number',
  'Invoice__Tax': 'Invoice.Tax'
};

// Create an instance of the PDF Services SDK credentials
const credentials = PDFServicesSdk.Credentials.servicePrincipalCredentialsBuilder()
  .withClientId(clientId)
  .withClientSecret(clientSecret)
  .build();

// Create an execution context using the credentials
const executionContext = PDFServicesSdk.ExecutionContext.create(credentials);

// Define the options for the extract PDF operation
const options = new PDFServicesSdk.ExtractPDF.options.ExtractPdfOptions.Builder()
  .addElementsToExtract(PDFServicesSdk.ExtractPDF.options.ExtractElementType.TEXT, PDFServicesSdk.ExtractPDF.options.ExtractElementType.TABLES)
  .addTableStructureFormat(PDFServicesSdk.ExtractPDF.options.TableStructureType.JSON)
  .build();

// Create a new extract PDF operation
const extractPDFOperation = PDFServicesSdk.ExtractPDF.Operation.createNew();

// Set the input file for the extract PDF operation
const input = PDFServicesSdk.FileRef.createFromLocalFile(inputPath, PDFServicesSdk.ExtractPDF.SupportedSourceFormat.pdf);
extractPDFOperation.setInput(input);

// Set the options for the extract PDF operation
extractPDFOperation.setOptions(options);

// Execute the extract PDF operation
extractPDFOperation.execute(executionContext)
  .then(result => result.saveAsFile(outputZipPath))
  .then(() => {
    // Extract the JSON file from the ZIP archive
    return unzipper.Open.file(outputZipPath);
  })
  .then((archive) => {
    const jsonEntry = archive.files.find(file => file.path.endsWith('.json'));
    if (jsonEntry) {
      return jsonEntry.buffer();
    } else {
      throw new Error('JSON file not found in the archive.');
    }
  })
  .then((buffer) => {
    const jsonData = JSON.parse(buffer.toString());

    const records = [columnNames];
    const dataRecord = {};

    for (const columnName in columnNames) {
      const jsonPath = columnNames[columnName];
      const value = getValueFromJsonPath(jsonPath, jsonData);
      dataRecord[columnName] = value;
    }

    records.push(dataRecord);

    const csvWriter = createCsvWriter({
      path: outputCsvPath,
      header: Object.keys(columnNames).map(column => ({ id: column, title: column }))
    });

    return csvWriter.writeRecords(records);
  })
  .then(() => {
    console.log('successfully generated CSV.');
  })
  .catch(err => {
    console.error('unexpected Error occurred ', err);
  });

// Helper function to get a value from a JSON object based on a given path
function getValueFromJsonPath(jsonPath, jsonData) {
  const keys = jsonPath.split('.');
  let value = jsonData;

  for (const key of keys) {
    if (value.hasOwnProperty(key)) {
      value = value[key];
    } else {
      value = null;
      break;
    }
  }

  return value;
}