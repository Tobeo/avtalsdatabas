const POOL = require('./mysql.js');

const saveCustomer = async function (data, req) {
    if (req.session.passport.user.presale && !req.session.passport.user.admin) {
        let teliaAnsvarig = (data.teliaansvarigInput.length < 1) ? `'Ej Angiven'` : `'${data.teliaansvarigInput}'`;
        let ucAnsvarig = (data.ucansvarigInput.length < 1) ? `'Ej Angiven'` : `'${data.ucansvarigInput}'`;
        let servicemanager = (data.smInput.length < 1) ? `'Ej Angiven'` : `'${data.smInput}'`;
        let lcm = (data.lcmInput.length < 1) ? `'Ej Angiven'` : `'${data.lcmInput}'`;
        let cms = (data.cmsInput.length < 1) ? `'Ej Angiven'` : `'${data.cmsInput}'`;
        let presale = (data.presaleInput.length < 1) ? `'Ej Angiven'` : `'${data.presaleInput}'`;
        await new Promise((resolve, reject) => {
            POOL.con.query(`UPDATE company SET 
                                teliaansvarig=${teliaAnsvarig},
                                ucansvarig=${ucAnsvarig},
                                servicemanager=${servicemanager},
                                lcm=${lcm},
                                cms=${cms},
                                presale=${presale},
                                lastUpdatedUser='${req.user.name}', 
                                lastUpdatedDate=NOW(), 
                                partOfGroup=${data.partOfGroup} 
                                WHERE orgnr='${data.company}'`, (err, result) => {
                if (err) {
                    log.error(err)
                    throw err;
                }
                resolve(result);
            })
        })
    } else {
        await saveHcs(data, req);
        let agreementStart = (data.agreementStartInput.length < 1) ? null : `'${data.agreementStartInput}'`;
        let agreementEnd = (data.agreementEndInput.length < 1) ? null : `'${data.agreementEndInput}'`;
        let teliaAnsvarig = (data.teliaansvarigInput.length < 1) ? `'Ej Angiven'` : `'${data.teliaansvarigInput}'`;
        let ucAnsvarig = (data.ucansvarigInput.length < 1) ? `'Ej Angiven'` : `'${data.ucansvarigInput}'`;
        let servicemanager = (data.smInput.length < 1) ? `'Ej Angiven'` : `'${data.smInput}'`;
        let lcm = (data.lcmInput.length < 1) ? `'Ej Angiven'` : `'${data.lcmInput}'`;
        let cms = (data.cmsInput.length < 1) ? `'Ej Angiven'` : `'${data.cmsInput}'`;
        let presale = (data.presaleInput.length < 1) ? `'Ej Angiven'` : `'${data.presaleInput}'`;
        let documentation = (data.documentationInput.length < 1) ? null : `'${data.documentationInput}'`;
        await new Promise((resolve, reject) => {
            POOL.con.query(`UPDATE company SET 
                                teliaansvarig=${teliaAnsvarig},
                                ucansvarig=${ucAnsvarig},
                                servicemanager=${servicemanager},
                                lcm=${lcm},
                                cms=${cms},
                                presale=${presale},
                                agreementStart=${agreementStart},
                                agreementEnd=${agreementEnd},
                                visma='${data.vismaInput}',
                                lastUpdatedUser='${req.user.name}',
                                autoProlong='${data.autoProlongInput}',
                                documentation=${documentation},
                                partOfGroup=${data.partOfGroup},
                                lastUpdatedDate=NOW()
                                WHERE orgnr='${data.company}'`, function (err, result) {
                if (err) {
                    log.error(err)
                    throw err;
                }
                resolve(result);
            })
        })
    }
}

const saveHcs = async function (data, req) {
    if (data.HCSorgnr) {
        return new Promise((resolve, reject) => {
            POOL.con.query(`UPDATE hcs SET comments='${data.HCScomments}',
            hcsid='${data.HCShcsid}',
            customer='${data.HCScustomer}',
            uc='${data.HCSuc}',
            platform='${data.HCSplatform}',
            cucm='${data.HCScucm}',
            ccx='${data.HCSccx}',
            hvd='${data.HCShvd}',
            ace='${data.HCSace}',
            ipphones='${data.HCSipphones}',
            softphones='${data.HCSsoftphones}',
            free='${data.HCSfree}',
            hvdkalender='${data.HCShvdkalender}',
            kontaktcenter='${data.HCSkontaktcenter}',
            telefonist='${data.HCStelefonist}',
            visitsystem='${data.HCSvisitsystem}',
            voicetelefonist='${data.HCSvoicetelefonist}',
            hvdos='${data.HCShvdos}',
            hvdsql='${data.HCShvdsql}',
            nordicreach='${data.HCSnordicreach}',
            globalreach='${data.HCSglobalreach}',
            direktrouting='${data.HCSdirektrouting}' 
            WHERE orgnr='${data.HCSorgnr}'`, function (err, result) {
                if (err) {
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

const getCompanyByProduct = async function (input) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`SELECT orgnr FROM product WHERE product LIKE '%${input}%' AND deleted = 'No'`, function (err, result) {
            if (err) {
                log.error(err)
                throw err;
            }
            let productsOrg = []
            result.map((element) => productsOrg.push(element.orgnr))
            if (productsOrg.length >= 1) {
                POOL.con.query(`SELECT * from company WHERE orgnr IN (${productsOrg.join()})`, function (err, companyResults) {
                    if (err) {
                        log.error(err)
                        throw err;
                    }
                    resolve(companyResults)
                })
            } else {
                resolve([])
            }

        })
    })
}

const getCompanyByGroup = async function (input) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`SELECT * FROM customergroups INNER JOIN company ON customergroups.id = company.partOfGroup WHERE customergroups.groupname LIKE '%${input}%' AND deleted = 0`, function (err, result) {
            if (err) {
                log.error(err)
                throw err;
            }
            resolve(result)
        })
    })
}

const getCompany = function (orgnr) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`SELECT * FROM company WHERE orgnr = ${orgnr}`, function (err, result, fields) {
            if (err) {
                log.error(err)
                throw err;
            }
            resolve(result);
        });
    });
};

const getCompanyByName = async function (query) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`SELECT * FROM company WHERE LOWER(kundnamn) LIKE '%${query}%' ORDER BY kundnamn COLLATE utf8mb4_swedish_ci ASC`, function (err, result, fields) {
            if (err) {
                log.error(err)
                throw err;
            }
            resolve(result);
        });
    });
};

const getNumbers = async function (orgnr) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`SELECT * FROM numbers WHERE orgnr = ${orgnr}`, function (err, result, fields) {
            if (err) {
                log.error(err)
                throw err;
            }
            resolve(result);
        });
    });
};

const loadComments = async function (orgnr) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`SELECT * FROM companycomments WHERE orgnr = ${orgnr}`, function (err, result, fields) {
            if (err) {
                log.error(err)
                throw err;
            }
            resolve(result);
        });
    });
}

const getHcs = async function (orgnr) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`SELECT * FROM hcs WHERE orgnr = ${orgnr}`, function (err, result, fields) {
            if (err) {
                log.error(err)
                throw err;
            }
            resolve(result);
        });
    });
};

const getProducts = async function (orgnr) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`SELECT * FROM product WHERE orgnr = ${orgnr}`, function (err, result, fields) {
            if (err) {
                log.error(err)
                throw err;
            }
            resolve(result);
        });
    });
};

const addNewCustomer = async function (data, user) {
    let regexp = /^[0-9]{6}-[0-9]{4}.*$|^[0-9]{10}.*$/;
    if (data.newCustomerOrg.length > 10) {
        data.newCustomerOrg = data.newCustomerOrg.replace("-", "").trim()
    }
    return new Promise((resolve, reject) => {
        POOL.con.query(`INSERT INTO company 
        (
            kundnamn, 
            orgnr, 
            visma, 
            teliaansvarig, 
            ucansvarig, 
            lastUpdatedUser, 
            lastUpdatedDate) 
            VALUES 
            (
                '${data.newCustomerName}', 
                '${data.newCustomerOrg}', 
                '${data.newCustomerVisma}', 
                '${data.newCustomerTelia}', 
                '${data.newCustomerUC}', 
                '${user}', 
                NOW()
            )`,
            (err, result) => {
                if (err) {
                    log.error(err)
                    throw err;
                }
                resolve(result)
            });
    });
};

const updateProduct = async function (data, req) {
    let supportend = (data.supportendInput.length < 1) ? null : `'${data.supportendInput}'`;
    let sql = `UPDATE product SET 
    product='${data.productInput}', 
    version='${data.versionInput}', 
    solution='${data.solutionInput}',
    licenses='${data.licensesInput}',
    supportend=${supportend},
    rentmodel='${data.rentmodelInput}',
    funktionsavtal='${data.funktionsavtalInput}',
    comments='${data.commentInput}',
    avslutat='${data.avslutatInput}',
    teliaBeredskap='${data.teliaBeredskapInput}',
    levBeredskap='${data.levBeredskapInput}', 
    editedBy='${req.user.name}', 
    editedAt=NOW()  
    WHERE id = '${data.id}'`;
    return new Promise((resolve, reject) => {
        POOL.con.query(sql, function (err, result) {
            if (err) {
                log.error(err)
                throw err;
            }
            resolve(result);
        });
    });
};

const addProduct = async (orgnr, req) => {
    return new Promise((resolve, reject) => {
        POOL.con.query(`INSERT INTO product 
            (
                orgnr, 
                product, 
                createdBy, 
                createdAt
            ) 
            VALUES 
            (
                '${orgnr}', 
                'Ny Produkt',
                '${req.user.name}', 
                NOW()
            )`,
            function (err, result) {
                if (err) {
                    log.error(err)
                    throw err;
                }
                resolve(result)
            })
    })
}

const loadGroups = async function (data, req) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`SELECT * FROM customergroups`, function (err, result) {
            if (err) {
                log.error(err)
                throw err;
            }
            resolve(result);
        });
    });
}

const addComment = async function (data, req) {
    let important;
    data.important ? important = 1 : important = 0;
    return new Promise((resolve, reject) => {
        POOL.con.query(`INSERT INTO companycomments 
        (
            orgnr, 
            comment, 
            createdBy, 
            createdAt, 
            important, 
            editedBy, 
            editedAt
        ) 
        VALUES 
        (
            '${data.company}', 
            '${data.commentInput}', 
            '${req.user.name}', 
            NOW(), 
            ${important}, 
            '${req.user.name}', 
            NOW()
        )`,
            function (err, result) {
                if (err) {
                    log.error(err)
                    throw err;
                }
                resolve(result);
            })
    })
}

const deleteComment = async function (data, req) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`UPDATE companycomments SET 
        deleted=1, 
        editedBy='${req.user.name}', 
        editedAt=NOW() 
        WHERE 
        id='${data.commentId}'`,
            function (err, result) {
                if (err) {
                    log.error(err)
                    throw err;
                }
                resolve(result);
            })
    })
}

const deleteProduct = async function (data, req) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`UPDATE product SET 
        deleted='Yes', 
        deletedBy='${req.user.name}', 
        deletedOn=NOW() 
        WHERE 
        id='${data.productId}'`,
            function (err, result) {
                if (err) {
                    log.error(err)
                    throw err;
                }
                resolve(result);
            })
    })
}

const updateComment = async function (data, req) {
    let important = (data.important) ? 1 : 0;
    return new Promise((resolve, reject) => {
        POOL.con.query(`UPDATE companycomments SET 
        important=${important}, 
        comment='${data.comment}', 
        editedBy='${req.user.name}', 
        editedAt=NOW() 
        WHERE 
        id='${data.commentId}'`,
            function (err, result) {
                if (err) {
                    log.error(err)
                    throw err;
                }
                resolve(result);
            })
    })
}

const addGroup = async function (data, req) {
    if (data.gruppnamn) {
        return new Promise((resolve, reject) => {
            POOL.con.query(`INSERT INTO customergroups 
            (
                groupname, 
                added_by, 
                added_date
            ) 
            VALUES 
            (
                '${data.gruppnamn}', 
                '${req.user.name}', 
                NOW()
            )`,
                function (err, result) {
                    if (err) {
                        log.error(err)
                        throw err;
                    }
                    resolve(result);
                })
        })
    } else {
        return 'No group sent'
    }
}

const modifyGroup = async function (data, req) {
    if (data.action == 'Update' && data.gruppnamn.length >= 1) {
        return new Promise((resolve, reject) => {
            POOL.con.query(`UPDATE customergroups SET 
            groupname='${data.gruppnamn}', 
            updated_by='${req.user.name}', 
            updated_date=NOW() 
            WHERE 
            id = ${data.selectedGroup}`,
                function (err, result) {
                    if (err) {
                        log.error(err)
                        throw err;
                    }
                    resolve(result);
                })
        })
    } else if (data.action == 'Delete') {
        return new Promise((resolve, reject) => {
            POOL.con.query(`UPDATE customergroups SET 
            deleted = 1, 
            deleted_by='${req.user.name}' 
            WHERE
            id = ${data.selectedGroup}`,
                function (err, result) {
                    if (err) {
                        log.error(err)
                        throw err;
                    }
                    resolve(result);
                })
        })
    } else {
        return "No action supplied or groupname too short."
    }
}

module.exports = {
    saveCustomer: saveCustomer,
    saveHcs: saveHcs,
    modifyGroup: modifyGroup,
    addGroup: addGroup,
    updateComment: updateComment,
    deleteProduct: deleteProduct,
    deleteComment: deleteComment,
    addComment: addComment,
    loadGroups: loadGroups,
    addProduct: addProduct,
    updateProduct: updateProduct,
    addNewCustomer: addNewCustomer,
    getProducts: getProducts,
    getHcs: getHcs,
    loadComments: loadComments,
    getNumbers: getNumbers,
    getCompanyByName: getCompanyByName,
    getCompany: getCompany,
    getCompanyByProduct: getCompanyByProduct,
    getCompanyByGroup: getCompanyByGroup
};