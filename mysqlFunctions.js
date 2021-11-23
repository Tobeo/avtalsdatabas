'use strict';
const POOL = require('./mysql.js')

const report = async (data) => {
    var query, version, licenses, supportend, agreementStart, agreementEnd, rentModel, funktionsavtal, solution, avslutat, orgnr
    var rentmodelArray = []
    var funktionsavtalArray = []
    var solutionArray = []
    var regexp = /^[0-9]{6}-[0-9]{4}.*$|^[0-9]{10}.*$/;
    if(data.orgnr.match(regexp)){
        if(data.orgnr.length > 10){
            data.orgnr = data.orgnr.replace("-", "").trim()
        }
        orgnr = `AND product.orgnr = ${data.orgnr}`
    }
    if(data.orgnr == ''){
        orgnr = '';
    }
    if(data.version == ''){
        version = '';
    } else {
        switch (data.versionFilter){
            case 'lessThan':
                version = `AND version < ${data.version}`
                break;
            case 'lessThanEqual':
                version = `AND version <= ${data.version}`
                break;
            case 'equal':
                version = `AND version = ${data.version}`
                break;
            case 'greaterThanEqual':
                version = `AND version >= ${data.version}`
                break;
            case 'greaterThan':
                version = `AND version > ${data.version}`
                break;
        }
    }
    if(data.licenses == ''){
        licenses = '';
    } else {
        switch (data.licensesFilter){
            case 'lessThan':
                licenses = `AND licenses < ${data.licenses}`
                break;
            case 'lessThanEqual':
                licenses = `AND licenses <= ${data.licenses}`
                break;
            case 'equal':
                licenses = `AND licenses = ${data.licenses}`
                break;
            case 'greaterThanEqual':
                licenses = `AND licenses >= ${data.licenses}`
                break;
            case 'greaterThan':
                licenses = `AND licenses > ${data.licenses}`
                break;
        }
    }
    if(data.supportend == ''){
        supportend = '';
    } else {
        switch (data.supportendFilter){
            case 'lessThan':
                supportend = `AND supportend < '${data.supportend}'`
                break;
            case 'lessThanEqual':
                supportend = `AND supportend <= '${data.supportend}'`
                break;
            case 'equal':
                supportend = `AND supportend = '${data.supportend}'`
                break;
            case 'greaterThanEqual':
                supportend = `AND supportend >= '${data.supportend}'`
                break;
            case 'greaterThan':
                supportend = `AND supportend > '${data.supportend}'`
                break;
        }
    }
    // if(data.agreementStart == ''){
    //     agreementStart = '';
    // } else {
    //     switch (data.agreementstartFilter){
    //         case 'lessThan':
    //             agreementStart = `AND agreementStart < ${data.agreementStart}`
    //             break;
    //         case 'lessThanEqual':
    //             agreementStart = `AND agreementStart <= ${data.agreementStart}`
    //             break;
    //         case 'equal':
    //             agreementStart = `AND agreementStart = '${data.agreementStart}'`
    //             break;
    //         case 'greaterThanEqual':
    //             agreementStart = `AND agreementStart >= ${data.agreementStart}`
    //             break;
    //         case 'greaterThan':
    //             agreementStart = `AND agreementStart > ${data.agreementStart}`
    //             break;
    //     }
    // }
    // if(data.agreementEnd == ''){
    //     agreementEnd = '';
    // } else {
    //     switch (data.agreementendFilter){
    //         case 'lessThan':
    //             agreementEnd = `AND agreementEnd < ${data.agreementEnd}`
    //             break;
    //         case 'lessThanEqual':
    //             agreementEnd = `AND agreementEnd <= ${data.agreementEnd}`
    //             break;
    //         case 'equal':
    //             agreementEnd = `AND agreementEnd = '${data.agreementEnd}'`
    //             break;
    //         case 'greaterThanEqual':
    //             agreementEnd = `AND agreementEnd >= ${data.agreementEnd}`
    //             break;
    //         case 'greaterThan':
    //             agreementEnd = `AND agreementEnd > ${data.agreementEnd}`
    //             break;
    //     }
    // }

    if(data.rentModel == 'all' || data.rentModel.includes('all')){
        rentModel = '';
    } else {
        if(typeof(data.rentModel) == 'string'){
            rentModel = `AND rentmodel = '${data.rentModel}'`
        }
        else {
        if(data.rentModel.includes('Ja')){rentmodelArray.push('Ja')}
        if(data.rentModel.includes('Nej')){rentmodelArray.push('Nej')}
        if(data.rentModel.includes('N/A')){rentmodelArray.push('N/A')}
        if(data.rentModel.includes('Trio Rent')){rentmodelArray.push('Trio Rent')}
        if(data.rentModel.includes('MLA')){rentmodelArray.push('MLA')}

        if(rentmodelArray.length == 1){
            rentModel = `AND rentmodel = ${rentmodelArray[0]}`
        } else {
            //finns förmodligen lättare sätt att mappa på men är lat och det funkar.
            rentModel = `AND (${rentmodelArray.map(x => 'rentmodel = "'+x+'" OR ').join('')})`.slice(0, -4)+')';
        }
    }
    }
    if(data.funktionsavtal == 'all' || data.funktionsavtal.includes('all')){
        funktionsavtal = '';
    } else {
        if(typeof(data.funktionsavtal) == 'string'){
            funktionsavtal = `AND funktionsavtal = '${data.funktionsavtal}'`
        }
        else {
            if(data.funktionsavtal.includes('Ja')){funktionsavtalArray.push('Ja')}
            if(data.funktionsavtal.includes('Nej')){funktionsavtalArray.push('Nej')}
            if(data.funktionsavtal.includes('N/A')){funktionsavtalArray.push('N/A')}
        if(funktionsavtalArray.length == 1){
            funktionsavtal = `AND funktionsavtal = ${funktionsavtalArray[0]}`
        } else {
            //finns förmodligen lättare sätt att mappa på men är lat och det funkar.
            funktionsavtal = `AND (${funktionsavtalArray.map(x => 'funktionsavtal = "'+x+'" OR ').join('')})`.slice(0, -4)+')';
        }
    }
    }
    if(data.solution == 'all' || data.solution.includes('all')){
        solution = '';
    } else {
        if(typeof(data.solution) == 'string'){
            solution = `AND solution = '${data.solution}'`
        }
        else {
            if(data.solution.includes('Ej Angiven')){solutionArray.push('Ej Angiven')}
            if(data.solution.includes('TelcoCloud')){solutionArray.push('TelcoCloud')}
            if(data.solution.includes('Cisco HCS')){solutionArray.push('Cisco HCS')}
            if(data.solution.includes('Cygate Cloud')){solutionArray.push('Cygate Cloud')}
            if(data.solution.includes('CPE')){solutionArray.push('CPE')}
            if(data.solution.includes('TelcoCloud/Hybrid')){solutionArray.push('TelcoCloud/Hybrid')}
            if(data.solution.includes('Cygate CPE Hosted')){solutionArray.push('Cygate CPE Hosted')}
            if(data.solution.includes('CPE Hosted')){solutionArray.push('CPE Hosted')}
            if(data.solution.includes('CPE Main')){solutionArray.push('CPE Main')}
            if(data.solution.includes('CPE Branch')){solutionArray.push('CPE Branch')}
            if(data.solution.includes('Remote Site')){solutionArray.push('Remote Site')}
            if(solutionArray.length == 1){
                solutionArray = `AND solution = ${solutionArray[0]}`
            } else {
                //finns förmodligen lättare sätt att mappa på men är lat och det funkar.
                solution = `AND (${solutionArray.map(x => 'solution = "'+x+'" OR ').join('')})`.slice(0, -4)+')';
            }          
        }

    }
    if(data.avslutatFilter == 'all'){
        avslutat = '';
    } else {
            if(data.avslutatFilter == 'Ja' ){avslutat = 'AND avslutat = "Ja"'}
            if(data.avslutatFilter == 'Nej' ){avslutat = 'AND avslutat = "Nej"'}
    }

    query = `SELECT * FROM product LEFT JOIN company ON product.orgnr = company.orgnr WHERE deleted='No' AND product LIKE '%${data.product}%' AND company.kundnamn LIKE '%${data.kundnamn}%' ${orgnr} ${version} ${licenses} ${supportend}  ${rentModel} ${funktionsavtal} ${solution} ${avslutat};`
    // ${agreementStart} ${agreementEnd}
    return new Promise((resolve, reject) => {
        POOL.con.query(query.trim(), (err, result) => {
            if(err) {
                log.error(err)
                throw err;
            }
            result.query = query;
            result.form = data;
            resolve(result);
        })
    })

}

module.exports = report;