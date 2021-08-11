'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const axios = require('axios');
const bunyan = require('bunyan');
const passport = require('passport');
const LdapStrategy = require('passport-ldapauth');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const fs = require('fs');
const ActiveDirectory = require('activedirectory2');
const https = require('https');
const flash = require('connect-flash');
const Excel = require("exceljs");
const MySQLStore = require('connect-mysql')(session);
const i18n = require('i18n');


// const helmet = require('helmet');

const app = express();
// app.use(helmet());
const generateExport = require('./excel.js');
const CONFIG = require('./config.js');
const SQL = require('./mysqlFunctions.js');
const SNS = require('./snssql.js');

var sessionStore = new session.MemoryStore;

const log = bunyan.createLogger(
{ 
    name: 'ldap',
    streams: [
        // trace log för ldap felsökning
        // {
        //     level: 'trace',
        //     path: './ldap.log'
        // },
        { 
            type: 'rotating-file',
            period: '1d',
            count: 7,
            level: 'info',
            path: './logs/dev.log'
        },
        {
            type: 'rotating-file',
            period: '1d',
            count: 7,
            level: 'error',
            path: './logs/dev.error.log'
        }
    ]
});

const OPTS = {
    server: {
        startTls: true,
        url: CONFIG.url,
        bindDN: CONFIG.bindDN,
        bindCredentials: CONFIG.bindCredentials,
        searchBase: 'OU=Users,OU=SE,OU=TS,OU=Hosting,DC=tcad,DC=telia,DC=se',
        searchAttributes: ['dn', 'cn', 'name', 'mail', 'sAMAccountName'],
        searchFilter: '(&(objectCategory=user)(objectClass=user)(sAMAccountName={{username}}))',
        groupSearchBase: 'OU=IDM,OU=Admin,OU=Hosting,DC=tcad,DC=telia,DC=se',
        groupDnProperty: 'sAMAccountName',
        groupSearchFilter: '(sAMAccountName=UC_Avtalsdatabas_User)',
        groupSearchAttributes: ['dn', 'cn', 'sAMAccountName', 'member'],
        tlsOptions: {
            ca: [fs.readFileSync('./WorkIT-Root.pem')],
        },
        log,
    }
};

const AdminOPTS = {
        startTls: true,
        url: CONFIG.url,
        username: CONFIG.bindDN,
        password: CONFIG.bindCredentials,
        baseDN: 'ou=Hosting,dc=tcad,dc=telia,dc=se',
        tlsOptions: {
            ca: [fs.readFileSync('./WorkIT-Root.pem')],
        }
};

var adminAD = new ActiveDirectory(AdminOPTS);

const ensureAuthenticated = (req, res, next) => {
    if (req && req.isAuthenticated()) {
        next();
    } else {
      res.render(__dirname+'/public/views/landing_page.ejs', {sessionError: true});
    }
};

passport.use('User', new LdapStrategy(OPTS, function(profile,done){
    adminAD.isUserMemberOf(profile.dn, 'UC_Avtalsdatabas_User', function(err, isMember){
        if(err) return done(err);
        if(!isMember){
            return done(null, false, {message: 'Saknar behörighet.'})
        }
        return done(null, profile)
    })
}));


passport.serializeUser(async function(user, done) {
    let sessionUser = {
        username: user.sAMAccountName,
        name: user.name,
        sessionID: user.sessionID,
        admin: false,
        hcsAdmin: false,
        sns: false
    };
    await Promise.all([
        checkAdmin(user),
        checkHcs(user),
    ]).then((responses) => {
        sessionUser.admin = responses[0]
        sessionUser.hcsAdmin = responses[1]
        log.info(`Serialized user ${sessionUser.name} as Admin: ${sessionUser.admin}, HCS-Admin: ${sessionUser.hcsAdmin}, SNS: ${sessionUser.sns}.`)
        done(null, sessionUser)
    })
  });

const checkAdmin = (user) => {
    return new Promise((resolve, reject) => {
        adminAD.isUserMemberOf(user.sAMAccountName, 'UC_Avtalsdatabas_Admin', function(err, isMember) {
            if (err) {
                console.log('ERROR: ' +JSON.stringify(err));
                return done(null, user);
            }
            resolve(isMember)
        }); 
    })
}

const checkHcs = (user) => {
    return new Promise((resolve, reject) => {
        adminAD.isUserMemberOf(user.sAMAccountName, 'UC_Avtalsdatabas_HCS', function(err, isMember) {
            if (err) {
                console.log('ERROR: ' +JSON.stringify(err));
                return done(null, user);
            }
            resolve(isMember)
        });    
    })
}

const checkSns = (user) => {
    return new Promise((resolve, reject) => {
        adminAD.isUserMemberOf(user.sAMAccountName, 'UC_Avtalsdatabas_SNS', function(err, isMember) {
            if (err) {
                console.log('ERROR: ' +JSON.stringify(err));
                return done(null, user);
            }
            resolve(isMember)
        });    
    })
}

  
passport.deserializeUser(function(user, done) {
    return done(null, user);
});

log.info('Server started, Logger active');
/* DB */
const POOL = require('./mysql.js');
/* DB */

app.use(session({
    secret: CONFIG.secret,
    store: sessionStore,
    rolling: true,
    resave: true,
    saveUninitialized: false,
    cookie: {
        httpOnly: true, 
        maxAge: 60 * 60 * 1000 // 1 hour -> 60 min * 60 sec * 1000 ms
    },
    store: new MySQLStore(POOL.poolOptions)
}));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', parameterLimit: 10000000, extended: false}));
app.use(cookieParser());
app.use(passport.initialize());
app.use(passport.session());
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));
app.use(flash())
i18n.configure({
    // setup some locales - other locales default to en silently
    locales: ['en', 'se'],
   
    // sets a custom cookie name to parse locale settings from
    cookie: 'locale',
   
    // where to store json files - defaults to './locales'
    directory: __dirname + '/locales'
});
app.use(i18n.init);
app.use((req, res, next) => {
    if (req.cookies.locale === undefined) {
      res.cookie('locale', 'se', {  maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true });
      req.setLocale('se');
}

next();
});


/* SQL FUNCTIONS START */

const getCompanyByComments = function (input) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`SELECT * FROM company WHERE comments LIKE '%${input}%'`, function (err, result) {
            if(err) {
                log.error(err)
                throw err;
            }
            resolve(result);
        })
    })
}

const getCompany = function (orgnr) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`SELECT * FROM company WHERE orgnr = ${orgnr}`, function (err, result, fields) {
            if(err) {
                log.error(err)
                throw err;
            }
            resolve(result);
        });
    });
};

const getCompanyByName = async function (query, user) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`SELECT * FROM company WHERE LOWER(kundnamn) LIKE '%${query}%' ORDER BY kundnamn COLLATE utf8mb4_swedish_ci ASC`, function (err, result, fields) {
            if(err) {
                log.error(err)
                throw err;
            }
            resolve(result);
        });
    });
};

const getNumbers = function (orgnr) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`SELECT * FROM numbers WHERE orgnr = ${orgnr}`, function (err, result, fields) {
            if(err) {
                log.error(err)
                throw err;
            }
            resolve(result);
        });
    });
};

const getHcs = function (orgnr) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`SELECT * FROM hcs WHERE orgnr = ${orgnr}`, function (err, result, fields) {
            if(err) {
                log.error(err)
                throw err;
            }
            resolve(result);
        });
    });
};



const getProducts = function (orgnr) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`SELECT * FROM product WHERE orgnr = ${orgnr}`, function (err, result, fields) {
            if(err) {
                log.error(err)
                throw err;
            }
            resolve(result);
        });
    });
};

const addNewCustomer = function(data, user) {
    let regexp = /^[0-9]{6}-[0-9]{4}.*$|^[0-9]{10}.*$/;
    if(data.newCustomerOrg.length > 10){
            data.newCustomerOrg = data.newCustomerOrg.replace("-", "").trim()
        }
    return new Promise((resolve, reject) => {
        POOL.con.query(`INSERT INTO company (kundnamn, orgnr, visma, teliaansvarig, ucansvarig, lastUpdatedUser, lastUpdatedDate) VALUES ('${data.newCustomerName}', '${data.newCustomerOrg}', '${data.newCustomerVisma}', '${data.newCustomerTelia}', '${data.newCustomerUC}', '${user}', NOW())`, (err, result) => {
            if(err) {
                log.error(err)
                throw err;
            }
            resolve(result)
        });
    });
};

const saveHcs = async function (data, req) {
    if(data.HCSorgnr){
        return new Promise((resolve, reject) => {
            POOL.con.query(`UPDATE hcs SET comments='${data.HCScomments}',hcsid='${data.HCShcsid}', customer='${data.HCScustomer}', uc='${data.HCSuc}', platform='${data.HCSplatform}', cucm='${data.HCScucm}', ccx='${data.HCSccx}', hvd='${data.HCShvd}',ace='${data.HCSace}',ipphones='${data.HCSipphones}',softphones='${data.HCSsoftphones}',free='${data.HCSfree}', hvdkalender='${data.HCShvdkalender}', kontaktcenter='${data.HCSkontaktcenter}', telefonist='${data.HCStelefonist}', visitsystem='${data.HCSvisitsystem}', voicetelefonist='${data.HCSvoicetelefonist}', hvdos='${data.HCShvdos}', hvdsql='${data.HCShvdsql}', nordicreach='${data.HCSnordicreach}', globalreach='${data.HCSglobalreach}', direktrouting='${data.HCSdirektrouting}' WHERE orgnr='${data.HCSorgnr}'`, function(err, result) {
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

const saveCustomer = async function (data, req) {
    await saveHcs(data, req);
    let agreementStart = (data.agreementStartInput.length < 1) ? null : `'${data.agreementStartInput}'`;
    let agreementEnd = (data.agreementEndInput.length < 1) ? null : `'${data.agreementEndInput}'`;
    let teliaAnsvarig = (data.teliaansvarigInput.length < 1) ? `'Ej Angiven'` : `'${data.teliaansvarigInput}'`;
    let ucAnsvarig = (data.ucansvarigInput.length < 1) ? `'Ej Angiven'` : `'${data.ucansvarigInput}'`;
    let servicemanager = (data.smInput.length < 1) ? `'Ej Angiven'` : `'${data.smInput}'`;
    let lcm = (data.lcmInput.length < 1) ? `'Ej Angiven'` : `'${data.lcmInput}'`;
    let cms = (data.cmsInput.length < 1) ? `'Ej Angiven'` : `'${data.cmsInput}'`;
    let presale = (data.presaleInput.length < 1) ? `'Ej Angiven'` : `'${data.presaleInput}'`;
    await new Promise((resolve,reject) => {
        POOL.con.query(`UPDATE company SET teliaansvarig=${teliaAnsvarig}, ucansvarig=${ucAnsvarig}, servicemanager=${servicemanager}, lcm=${lcm}, cms=${cms}, presale=${presale},
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
        let sql = `UPDATE product SET deleted='Yes', deletedBy='${req.user.name}', deletedOn=NOW() WHERE id IN (${data.delete})`;
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
            let sql = `UPDATE product SET product='${data.productInput}', version='${data.versionInput}', solution='${data.solutionInput}',licenses='${data.licensesInput}',
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
                let sql = `UPDATE product SET product = '${data.productInput[i]}', version='${data.versionInput[i]}', solution='${data.solutionInput[i]}',licenses='${data.licensesInput[i]}',
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

const addProduct = function(orgnr) {
    return new Promise((resolve, reject) => {
        POOL.con.query(`INSERT INTO product (orgnr, product) VALUES ('${orgnr}', 'Ny Produkt')`, function(err, result) {
            if(err) {
                log.error(err)
                throw err;
            }
            resolve(result)
        })
    })
}



/* SQL FUNCTIONS END */

app.post('/login', passport.authenticate('User' ,{
    successRedirect: '/landing', 
    failureRedirect: '/errLogin', 
    failureFlash: true,
    session: true
}));

app.get('/', function(req,res) {
        res.render(__dirname + '/public/views/landing_page.ejs')
})

app.get('/idm', function(req,res) {
    res.render(__dirname + '/public/views/idm.ejs')
})

app.get('/landing', ensureAuthenticated, function(req,res){
    res.render(__dirname + '/public/views/index.ejs', {
        data: {},
        sessionUser: req.session.passport.user,
        commentsData: []
    });
});

app.get('/new', ensureAuthenticated, function(req,res) {
    res.render(__dirname + '/public/views/newCustomer.ejs', {
        data: {},
        sessionUser: req.session.passport.user,
    })
})

app.post('/', ensureAuthenticated, async (req,res,next) => {
    /*Matchar format 5566778899 samt 556677-8899 med whitespace efter*/
    let regexp = /[0-9]{6}-[0-9]{4}.*|[0-9]{10}.*/;
    
    if(req.body.company.match(regexp)){
        if(req.body.company.length > 10){
            req.body.company = req.body.company.replace("-", "").trim()
        }
        POOL.con.query(`SELECT * FROM company WHERE orgnr = ${req.body.company}`, (err,result) => {
            if(err) {
                log.error(err)
                throw err;
            }
            res.render(__dirname + '/public/views/index.ejs', {
                data:result,
                sessionUser: req.session.passport.user,
                commentsData: []
            })
        })
    } else {
        let commentsData, companyData;
        Promise.all([
            getCompanyByName(req.body.company),
            getCompanyByComments(req.body.company),
        ]).then(result => {
                companyData = result[0];
                commentsData = result[1];
                if(req.user.sns){
                    Promise.all([SNS.getSns(req.body.company, req.user)])
                    .then(result => {
                        companyData = companyData.concat(result[0])
                        res.render(__dirname + '/public/views/index.ejs', {
                            data:companyData,
                            sessionUser: req.session.passport.user,
                            commentsData: commentsData,
                            searchedString: req.body.company
                    })
                    })
                } else {
                    res.render(__dirname + '/public/views/index.ejs', {
                        data:companyData,
                        sessionUser: req.session.passport.user,
                        commentsData: commentsData,
                        searchedString: req.body.company
                })
                }
            })
    }
});

/* Selecting customer using a button after search */
app.get('/customer/:org',ensureAuthenticated, async (req,res,next) => {
    let companyData, productData, numbersData, hcsData;
    Promise.all([
  await getCompany(req.params.org),
  await getProducts(req.params.org),
  await getNumbers(req.params.org),
  await getHcs(req.params.org),
]).then(resultArr => {
  companyData = resultArr[0][0];
  productData = resultArr[1];
  numbersData = resultArr[2];
  hcsData = resultArr[3];
  res.render(__dirname + '/public/views/showCustomer.ejs', {
    companyData: companyData,
    productData: productData,
    numbersData: numbersData,
    hcsData: hcsData,
    sessionUser: req.session.passport.user,
  });
});
})
/* Selecting customer using a button after search */
app.get('/customerSns/:org',ensureAuthenticated, async (req,res,next) => {
    if(req.user.sns){
        let companyData, productData, numbersData, hcsData;
        Promise.all([
      await SNS.getSnsCompany(req.params.org, req.user),
      await SNS.getSnsProducts(req.params.org, req.user),
      await SNS.getSnsNumbers(req.params.org, req.user),
      await SNS.getSnsHcs(req.params.org, req.user),
    ]).then(resultArr => {
      companyData = resultArr[0][0];
      productData = resultArr[1];
      numbersData = resultArr[2];
      hcsData = resultArr[3];
      res.render(__dirname + '/public/views/showCustomer.ejs', {
        companyData: companyData,
        productData: productData,
        numbersData: numbersData,
        hcsData: hcsData,
        sessionUser: req.session.passport.user,
      });
    });
    } else {
        SNS.snsLog.info(`User ${req.user.name} tried to acces /customerSns/${req.params.org} without proper access.`)
    }

})

app.get('/reports', ensureAuthenticated, (req,res,next) => {
    res.render(__dirname + '/public/views/reports.ejs', 
    {
        data: req.body,
        sessionUser: req.session.passport.user
    })
})

app.post('/searchReport', ensureAuthenticated, async (req,res,next) => {
    Promise.all(
        [
            SQL(req.body)
    ]).then(async (reportData) => {
        res.render(__dirname + '/public/views/reports.ejs', {
            reportData: reportData[0],
            reportForm: reportData[0].form,
            data: {},
            sessionUser: req.session.passport.user,
            lastQuery: req.body
        })
    })

})

app.post('/createNewCustomer',ensureAuthenticated, async (req,res,next) => {
    Promise.all([
        await addNewCustomer(req.body, req.user.name)
        ]).then(resultArr => {
            res.render(__dirname + '/public/views/newCustomerSuccess.ejs',{
                data: req.body,
                sessionUser: req.session.passport.user
            })
        })
})

app.post('/createHcs/:orgnr', ensureAuthenticated, async (req,res,next) => {
    await new Promise((resolve,reject) => {
        POOL.con.query(`INSERT INTO hcs (orgnr) VALUES ('${req.params.orgnr}');`, (err, result) => {
            if(err) log.error(err);
            resolve(result)
        })
    }).then(() => {
        res.redirect(`/customer/${req.params.orgnr}`)
    })
})

app.post('/addProduct', ensureAuthenticated, async (req,res,next) => {
    let companyData, productData, numbersData, hcsData;
        addProduct(req.body.company)
        .then(() => {
            Promise.all([
                getCompany(req.body.company),
                getProducts(req.body.company),
                getNumbers(req.body.company),
                getHcs(req.body.company)
            ]).then(resultArr => {
                companyData = resultArr[0][0];
                productData = resultArr[1];
                numbersData = resultArr[2];
                hcsData = resultArr[3];
                res.render(__dirname + '/public/views/showCustomer.ejs', {
                    companyData: companyData,
                    productData: productData,
                    numbersData: numbersData,
                    hcsData: hcsData,
                    sessionUser: req.session.passport.user,
                })
            })
        }
    )
})

app.post('/addProductSns', ensureAuthenticated, async (req,res,next) => {
    let companyData, productData, numbersData, hcsData;
        SNS.addProductSns(req.body.company, req.user)
        .then(() => {
            Promise.all([
                SNS.getSnsCompany(req.body.company),
                SNS.getSnsProducts(req.body.company),
                SNS.getSnsNumbers(req.body.company),
                SNS.getSnsHcs(req.body.company)
            ]).then(resultArr => {
                companyData = resultArr[0][0];
                productData = resultArr[1];
                numbersData = resultArr[2];
                hcsData = resultArr[3];
                res.render(__dirname + '/public/views/showCustomer.ejs', {
                    companyData: companyData,
                    productData: productData,
                    numbersData: numbersData,
                    hcsData: hcsData,
                    sessionUser: req.session.passport.user,
                })
            })
        }
    )
})

app.post('/editCustomer',ensureAuthenticated, async (req,res,next) => {
    let companyData, productData, numbersData, hcsData;
    Promise.all([
        await getCompany(req.body.company),
        await getProducts(req.body.company),
        await getHcs(req.body.company)
        ]).then(resultArr => {
            companyData = resultArr[0][0];
            productData = resultArr[1];
            hcsData = resultArr[2];
            res.render(__dirname + '/public/views/editCustomerPage.ejs', {
                companyData: companyData,
                productData: productData,
                numbersData: numbersData,
                hcsData: hcsData,
                sessionUser: req.session.passport.user
            })
        })
})

app.post('/editCustomerSns',ensureAuthenticated, async (req,res,next) => {
    let companyData, productData, numbersData, hcsData;
    Promise.all([
        await SNS.getSnsCompany(req.body.company),
        await SNS.getSnsProducts(req.body.company),
        await SNS.getSnsHcs(req.body.company)
        ]).then(resultArr => {
            companyData = resultArr[0][0];
            productData = resultArr[1];
            hcsData = resultArr[2];
            res.render(__dirname + '/public/views/editCustomerPage.ejs', {
                companyData: companyData,
                productData: productData,
                numbersData: numbersData,
                hcsData: hcsData,
                sessionUser: req.session.passport.user
            })
        })
})

app.post('/editHcs',ensureAuthenticated, async (req,res,next) => {
    let companyData, productData, numbersData, hcsData;
    Promise.all([
        await getCompany(req.body.company),
        await getProducts(req.body.company),
        await getNumbers(req.body.company),
        await getHcs(req.body.company)
        ]).then(resultArr => {
            companyData = resultArr[0][0];
            productData = resultArr[1];
            numbersData = resultArr[2];
            hcsData = resultArr[3];
            res.render(__dirname + '/public/views/editCustomerPage.ejs', {
                companyData: companyData,
                productData: productData,
                numbersData: numbersData,
                hcsData: hcsData,
                sessionUser: req.session.passport.user
            })
        })
})

app.post('/export', ensureAuthenticated, async (req,res,next) => {
    var fileName = `UC Avtalsdatabas ${new Date().toLocaleString("en-SE").replace(",","")}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=" + fileName);
    await generateExport(res, req.body);
})

app.post('/saveCustomer',ensureAuthenticated, async (req,res,next) => {
    let data=req.body;
    await saveCustomer(data, req).then(
        () => {
            res.redirect(`/customer/${data.company}`)
        }
    )

    })

app.post('/saveHcs',ensureAuthenticated, async (req,res,next) => {
    let data=req.body;
    await saveHcs(data, req).then(
        () => {
            res.redirect(`/customer/${data.company}`)
        }
    )    
    })

app.get('/errLogin', function(req,res){
    res.render(__dirname+'/public/views/landing_page.ejs', {
        errorLogin: true,
        messages: req.flash('error')
    })
})    

app.get('/logout', function(req, res){
    if(req.user) {
        log.info('User logged out: ' + req.user.name)
        req.logout();
        res.render(__dirname+'/public/views/landing_page.ejs', {loggedOut: true})
    } else {
        res.render(__dirname+'/public/views/landing_page.ejs')
    }
    
});

app.get('/locale/:lang', function(req, res) {
    let lang = req.params.lang
    res.clearCookie('locale')
    res.cookie('locale', lang, {  maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true });
    req.setLocale(lang)
    res.redirect('/landing');    
})
app.get('/locales/:lang', function(req, res) {
    let lang = req.params.lang
    res.clearCookie('locale')
    res.cookie('locale', lang, {  maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true });
    req.setLocale(lang)
    res.redirect('/');    
})

app.get('*', function(req,res){
    res.render(__dirname+'/public/views/landing_page.ejs', {wrongUrl: true})
})


// app.listen(CONFIG.PORT, function(){
//     console.log(`Running server on ${CONFIG.PORT}`);
// });

// Kommentera bort ovan samt kommentera ut nedan för http + inga error loggar

app.use(function(err, req, res, next){
    log.error(err)
    res.status(500);
    res.render(__dirname+'/public/views/error.ejs');
});
https.createServer(CONFIG.https_options, app).listen(CONFIG.PORT);
