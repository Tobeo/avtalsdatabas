'use strict';
const POOL = require('./mysql.js')
const bunyan = require('bunyan');


const snsLog = bunyan.createLogger( {
    name: 'sns',
    streams: [
        {
            level: 'info',
            path: './logs/sns.log'
        }

    ]
})

const getSns = async function (query, user) {
        return new Promise((resolve, reject) => {
            POOL.con.query(`SELECT * FROM snscompany WHERE LOWER(kundnamn) LIKE '%${query}%'`, function (err, result) {
                if(err) {
                    throw err;
                }
                snsLog.info(`User ${user.name} performed search resulting in ${[...result]} from SNS database.`)
                resolve(result);
            });
        });
};

const getSnsCompany = function (orgnr, user) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`SELECT * FROM snscompany WHERE orgnr = ${orgnr}`, function (err, result, fields) {
            if(err) {
                log.error(err)
                throw err;
            }
            snsLog.info(`User ${user.name} retrieved Company info consisting of ${JSON.stringify(result[0])}`)
            resolve(result);
        });
    });
};

const getSnsProducts = function (orgnr, user) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`SELECT * FROM snsproduct WHERE orgnr = ${orgnr}`, function (err, result, fields) {
            if(err) {
                log.error(err)
                throw err;
            }
            snsLog.info(`User ${user.name} retrieved Product info consisting of ${JSON.stringify(result[0])}`)
            resolve(result);
        });
    });
};

const getSnsNumbers = function (orgnr, user) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`SELECT * FROM snsnumbers WHERE orgnr = ${orgnr}`, function (err, result, fields) {
            if(err) {
                log.error(err)
                throw err;
            }
            snsLog.info(`User ${user.name} retrieved Number info consisting of ${JSON.stringify(result[0])}`)
            resolve(result);
        });
    });
};

const getSnsHcs = function (orgnr, user) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`SELECT * FROM hcs WHERE orgnr = ${orgnr}`, function (err, result, fields) {
            if(err) {
                log.error(err)
                throw err;
            }
            if(result[0] != undefined){
                snsLog.info(`User ${user.name} retrieved HCS info consisting of ${JSON.stringify(result[0])}`)
            } else {
                snsLog.info(`Customer ${orgnr} has no HCS data.`)
            }
            resolve(result);
        });
    });
};

const saveSnsHcs = async function (data, req) {
    if(data.HCSorgnr){
        return new Promise((resolve, reject) => {
            POOL.con.query(`UPDATE snshcs SET comments='${data.HCScomments}',hcsid='${data.HCShcsid}', customer='${data.HCScustomer}', uc='${data.HCSuc}', platform='${data.HCSplatform}', cucm='${data.HCScucm}', ccx='${data.HCSccx}', hvd='${data.HCShvd}',ace='${data.HCSace}',ipphones='${data.HCSipphones}',softphones='${data.HCSsoftphones}',free='${data.HCSfree}', hvdkalender='${data.HCShvdkalender}', kontaktcenter='${data.HCSkontaktcenter}', telefonist='${data.HCStelefonist}', visitsystem='${data.HCSvisitsystem}', voicetelefonist='${data.HCSvoicetelefonist}', hvdos='${data.HCShvdos}', hvdsql='${data.HCShvdsql}', nordicreach='${data.HCSnordicreach}', globalreach='${data.HCSglobalreach}', direktrouting='${data.HCSdirektrouting}' WHERE orgnr='${data.HCSorgnr}'`, function(err, result) {
                if(err) {
                    log.error(err)
                    throw err;
                }
                resolve(result);
            })
        })
    } else {
        return 'No HCS-data sent'
    }
}

const saveSnsCustomer = async function (data, req) {
    await saveSnsHcs(data, req);
    let agreementStart = (data.agreementStartInput.length < 1) ? null : `'${data.agreementStartInput}'`;
    let agreementEnd = (data.agreementEndInput.length < 1) ? null : `'${data.agreementEndInput}'`;
    let teliaAnsvarig = (data.teliaansvarigInput.length < 1) ? `'Ej Angiven'` : `'${data.teliaansvarigInput}'`;
    let ucAnsvarig = (data.ucansvarigInput.length < 1) ? `'Ej Angiven'` : `'${data.ucansvarigInput}'`;
    let servicemanager = (data.smInput.length < 1) ? `'Ej Angiven'` : `'${data.smInput}'`;
    let lcm = (data.lcmInput.length < 1) ? `'Ej Angiven'` : `'${data.lcmInput}'`;
    let cms = (data.cmsInput.length < 1) ? `'Ej Angiven'` : `'${data.cmsInput}'`;
    let presale = (data.presaleInput.length < 1) ? `'Ej Angiven'` : `'${data.presaleInput}'`;
    await new Promise((resolve,reject) => {
        POOL.con.query(`UPDATE snscompany SET teliaansvarig=${teliaAnsvarig}, ucansvarig=${ucAnsvarig}, servicemanager=${servicemanager}, lcm=${lcm}, cms=${cms}, presale=${presale},
        agreementStart=${agreementStart},agreementEnd=${agreementEnd}, visma='${data.vismaInput}',comments='${data.companyCommentsInput}',
        lastUpdatedUser='${req.user.name}', autoProlong='${data.autoProlongInput}', lastUpdatedDate=NOW() WHERE orgnr='${data.company}'`, function(err, result) {
            if(err) {
                log.error(err)
                throw err;
            }
            resolve(result);
        })
    })
    if (data.delete) {
        let sql = `UPDATE snsproduct SET deleted='Yes', deletedBy='${req.user.name}', deletedOn=NOW() WHERE id IN (${data.delete})`;
        await new Promise((resolve, reject) => {
            POOL.con.query(sql, function (err, result) {
                if(err) {
                    log.error(err)
                    throw err;
                }
                resolve(result);
            });
        });
    }
    if(data.id){
        if (Array.isArray(data.id) === false) {
            let supportend = (data.supportendInput.length < 1) ? null : `'${data.supportendInput}'`;
            let sql = `UPDATE snsproduct SET product='${data.productInput}', version='${data.versionInput}', solution='${data.solutionInput}',licenses='${data.licensesInput}',
                supportend=${supportend},rentmodel='${data.rentmodelInput}',funktionsavtal='${data.funktionsavtalInput}',
                comments='${data.commentInput}',avslutat='${data.avslutatInput}',teliaBeredskap='${data.teliaBeredskapInput}',levBeredskap='${data.levBeredskapInput}' WHERE id = '${data.id}'`;
            return new Promise((resolve, reject) => {
                POOL.con.query(sql, function (err, result) {
                    if(err) {
                        log.error(err)
                        throw err;
                    }
                    resolve(result);
                });
            });
    
        }
        else {
            let promises;
            for (let i = 0; i < data.id.length; i++) {
                let supportend = (data.supportendInput[i].length < 1) ? null : `'${data.supportendInput[i]}'`;
                let sql = `UPDATE snsproduct SET product = '${data.productInput[i]}', version='${data.versionInput[i]}', solution='${data.solutionInput[i]}',licenses='${data.licensesInput[i]}',
                            supportend=${supportend},rentmodel='${data.rentmodelInput[i]}',funktionsavtal='${data.funktionsavtalInput[i]}',
                            comments='${data.commentInput[i]}',avslutat='${data.avslutatInput[i]}',teliaBeredskap='${data.teliaBeredskapInput[i]}',levBeredskap='${data.levBeredskapInput[i]}' WHERE id = '${data.id[i]}'`;
                POOL.con.query(sql, function (err, result) {
                    if(err) {
                        log.error(err)
                        throw err;
                    }
                    promises += result;
                });
            }
            return new Promise((resolve, reject) => {
                resolve(promises);
            });
        }
    }
}

const addProductSns = function(orgnr, user) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`INSERT INTO snsproduct (orgnr, product) VALUES ('${orgnr}', 'Ny Produkt')`, function(err, result) {
            if(err) {
                log.error(err)
                throw err;
            }
            snsLog.info(`User ${user.name} created new product for ${JSON.stringify(result[0])}`)
            resolve(result)
        })

    })
}


module.exports = {
    snsLog,
    getSns,
    getSnsCompany,
    getSnsProducts,
    getSnsNumbers,
    getSnsHcs,
    saveSnsHcs,
    saveSnsCustomer,
    addProductSns
};