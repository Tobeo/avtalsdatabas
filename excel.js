const Excel = require("exceljs");
const _ = require("lodash");


const generateWorkBook = async (res, data) => {
    var options = {
      filename: "./streamed-workbook.xlsx",
      useStyles: true,
      useSharedStrings: true
    };
    var workbook = new Excel.Workbook(options);
  
    workbook.creator = "UC Avtalsdatabas";
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.views = [
      {
        x: 0,
        y: 0,
        width: 10000,
        height: 20000,
        firstSheet: 0,
        activeTab: 1,
        visibility: "visible"
      }
    ];
    // create a sheet with red tab colour
    var sheet = workbook.addWorksheet("Sheet");
    // fetch sheet by name
    var worksheet = workbook.getWorksheet("Sheet");
    var sortedData = {
      Kundnamn: data.kundnamn,
      UCAnsvarig: data.ucansvarig,
      TeliaAnsvarig: data.teliaansvarig,
      Organisationsnummer: data.orgnr,
      SM: data.servicemanager,
      LCM: data.lcm,
      CMS: data.cms,
      Produkt: data.product,
      Version: data.version,
      TypAvLösning: data.solution,
      AntalAnvändare: data.licenses,
      SupportKöptTill: data.supportend,
      Hyresmodell: data.rentmodel,
      Funktionsavtal: data.funktionsavtal,
      AvtalStart: data.agreementStart,
      AvtalSlut: data.agreementEnd,
      Avslutat: data.avslutat,
      id: data.id,
      Kommentar: data.comments,
      TeliaBeredskap: data.teliaBeredskap,
      LeverantörBeredskap: data.levBeredskap    
    }
  
    worksheet.addRow(Object.keys(sortedData))
    worksheet.columns = [
        {width: 21},
        {width: 21},
        {width: 21},
        {width: 21},
        {width: 21},
        {width: 21},
        {width: 21},
        {width: 16},
        {width: 8},
        {width: 13},
        {width: 15},
        {width: 15},
        {width: 12},
        {width: 14},
        {width: 10},
        {width: 10},
        {width: 8},
        {width: 5},
        {width: 50},
        {width: 50},
        {width: 50}
    ]
    _.range(0, sortedData.id.length).map((itemIndex) =>
      worksheet.addRow(
        _.range(0,Object.keys(sortedData).length).map((item) =>
            sortedData[Object.keys(sortedData)[item]][itemIndex]
        )
      )
    )
  
    worksheet.getRow(1).font = {
      bold: true
    };
  
    await workbook.xlsx.write(res);
  };

  module.exports = generateWorkBook;