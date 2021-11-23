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
        searchBase: redacted,
        searchAttributes: ['dn', 'cn', 'name', 'mail', 'sAMAccountName'],
        searchFilter: '(&(objectCategory=user)(objectClass=user)(sAMAccountName={{username}}))',
        groupSearchBase: redacted,
        groupDnProperty: 'sAMAccountName',
        groupSearchFilter: '(sAMAccountName=UC_Avtalsdatabas_User)',
        groupSearchAttributes: ['dn', 'cn', 'sAMAccountName', 'member'],
        tlsOptions: {
            ca: [fs.readFileSync('./redacted.pem')],
        },
        log,
    }
};

const AdminOPTS = {
    startTls: true,
    url: CONFIG.url,
    username: CONFIG.bindDN,
    password: CONFIG.bindCredentials,
    baseDN: redacted,
    tlsOptions: {
        ca: [fs.readFileSync('./redacted.pem')],
    }
};

var adminAD = new ActiveDirectory(AdminOPTS);

const ensureAuthenticated = (req, res, next) => {
    if (req && req.isAuthenticated()) {
        next();
    } else {
        res.render(__dirname + '/public/views/landing_page.ejs', { sessionError: true });
    }
};

passport.use('User', new LdapStrategy(OPTS, function (profile, done) {
    adminAD.isUserMemberOf(profile.dn, 'UC_Avtalsdatabas_User', function (err, isMember) {
        if (err) return done(err);
        if (!isMember) {
            return done(null, false, { message: 'Saknar behörighet.' })
        }
        return done(null, profile)
    })
}));


passport.serializeUser(async function (user, done) {
    let sessionUser = {
        username: user.sAMAccountName,
        name: user.name,
        sessionID: user.sessionID,
        admin: false,
        hcsAdmin: false,
        sns: false,
        presale: false
    };
    await Promise.all([
        checkAdmin(user),
        checkHcs(user),
        checkPresale(user),
    ]).then((responses) => {
        sessionUser.admin = responses[0]
        sessionUser.hcsAdmin = responses[1]
        sessionUser.presale = responses[2]
        log.info(`Serialized user ${sessionUser.name} as Admin: ${sessionUser.admin}, HCS-Admin: ${sessionUser.hcsAdmin}, SNS: ${sessionUser.sns}, Presale: ${sessionUser.presale}.`)
        done(null, sessionUser)
    })
});

const checkAdmin = (user) => {
    return new Promise((resolve, reject) => {
        adminAD.isUserMemberOf(user.sAMAccountName, 'UC_Avtalsdatabas_Admin', function (err, isMember) {
            if (err) {
                console.log('ERROR: ' + JSON.stringify(err));
                return done(null, user);
            }
            resolve(isMember)
        });
    })
}

const checkHcs = (user) => {
    return new Promise((resolve, reject) => {
        adminAD.isUserMemberOf(user.sAMAccountName, 'UC_Avtalsdatabas_HCS', function (err, isMember) {
            if (err) {
                console.log('ERROR: ' + JSON.stringify(err));
                return done(null, user);
            }
            resolve(isMember)
        });
    })
}

const checkPresale = (user) => {
    return new Promise((resolve, reject) => {
        adminAD.isUserMemberOf(user.sAMAccountName, 'UC_Avtalsdatabas_Presale', function (err, isMember) {
            if (err) {
                console.log('ERROR: ' + JSON.stringify(err));
                return done(null, user);
            }
            resolve(isMember)
        });
    })
}

const checkSns = (user) => {
    return new Promise((resolve, reject) => {
        adminAD.isUserMemberOf(user.sAMAccountName, 'UC_Avtalsdatabas_SNS', function (err, isMember) {
            if (err) {
                console.log('ERROR: ' + JSON.stringify(err));
                return done(null, user);
            }
            resolve(isMember)
        });
    })
}


passport.deserializeUser(function (user, done) {
    return done(null, user);
});


/* DB */
const POOL = require('./mysql.js');
const QUERY = require('./queries.js');
const { getgroups } = require('process');
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
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', parameterLimit: 10000000, extended: false }));
app.use(cookieParser());
app.use(passport.initialize());
app.use(passport.session());
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));
app.use(flash())
i18n.configure({
    // setup some locales - other locales default to en
    locales: ['en', 'se'],

    // sets a custom cookie name to parse locale settings from
    cookie: 'locale',

    // where to store json files - defaults to './locales'
    directory: __dirname + '/locales'
});
app.use(i18n.init);
app.use((req, res, next) => {
    if (req.cookies.locale === undefined) {
        res.cookie('locale', 'se', { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true });
        req.setLocale('se');
    }
    next();
});


/* SQL FUNCTIONS START */
// Moved to queries.js


// const getCompanyByComments = async function (input) {
//     return new Promise((resolve, reject) => {
//         POOL.con.query(`SELECT * FROM company WHERE comments LIKE '%${input}%'`, function (err, result) {
//             if(err) {
//                 log.error(err)
//                 throw err;
//             }
//             resolve(result);
//         })
//     })
// }

/* SQL FUNCTIONS END */

app.post('/login', passport.authenticate('User', {
    successRedirect: '/landing',
    failureRedirect: '/errLogin',
    failureFlash: true,
    session: true
}));

app.get('/', function (req, res) {
    res.render(__dirname + '/public/views/landing_page.ejs')
})

app.get('/idm', function (req, res) {
    res.render(__dirname + '/public/views/idm.ejs')
})

app.get('/landing', ensureAuthenticated, function (req, res) {
    res.render(__dirname + '/public/views/index.ejs', {
        data: {},
        sessionUser: req.session.passport.user,
        commentsData: [],
        productsData: [],
        groupData: []
    });
});

app.get('/new', ensureAuthenticated, function (req, res) {
    res.render(__dirname + '/public/views/newCustomer.ejs', {
        data: {},
        sessionUser: req.session.passport.user,
    })
})

app.post('/', ensureAuthenticated, async (req, res, next) => {
    /*Matchar format 5566778899 samt 556677-8899 med whitespace efter*/
    let regexp = /[0-9]{6}-[0-9]{4}.*|[0-9]{10}.*/;

    if (req.body.company.match(regexp)) {
        if (req.body.company.length > 10) {
            req.body.company = req.body.company.replace("-", "").trim()
        }
        res.redirect(`/customer/${req.body.company}`);
    } else {
        let commentsData, companyData, productsData, groups, groupData;
        Promise.all([
            await QUERY.getCompanyByName(req.body.company),
            await QUERY.getCompanyByProduct(req.body.company),
            await QUERY.loadGroups(),
            await QUERY.getCompanyByGroup(req.body.company)
        ]).then(result => {
            companyData = result[0];
            productsData = result[1];
            groups = result[2];
            groupData = result[3];
            if (req.user.sns) {
                Promise.all([SNS.getSns(req.body.company, req.user)])
                    .then(result => {
                        companyData = companyData.concat(result[0])
                        res.render(__dirname + '/public/views/index.ejs', {
                            data: companyData,
                            sessionUser: req.session.passport.user,
                            groupData: groupData,
                            searchedString: req.body.company,
                            productsData: productsData,
                            groups: groups
                        })
                    })
            } else {
                res.render(__dirname + '/public/views/index.ejs', {
                    data: companyData,
                    sessionUser: req.session.passport.user,
                    commentsData: commentsData,
                    groupData: groupData,
                    searchedString: req.body.company,
                    productsData: productsData,
                    groups: groups
                })
            }
        })
    }
});

/* Selecting customer using a button after search */
app.get('/customer/:org', ensureAuthenticated, async (req, res, next) => {
    let companyData, productData, numbersData, hcsData, groups, comments;
    Promise.all([
        await QUERY.getCompany(req.params.org),
        await QUERY.getProducts(req.params.org),
        await QUERY.getNumbers(req.params.org),
        await QUERY.getHcs(req.params.org),
        await QUERY.loadGroups(),
        await QUERY.loadComments(req.params.org)
    ]).then(resultArr => {
        companyData = resultArr[0][0];
        productData = resultArr[1];
        numbersData = resultArr[2];
        hcsData = resultArr[3];
        groups = resultArr[4];
        comments = resultArr[5];
        res.render(__dirname + '/public/views/showCustomer.ejs', {
            companyData: companyData,
            productData: productData,
            numbersData: numbersData,
            hcsData: hcsData,
            sessionUser: req.session.passport.user,
            groups: groups,
            companyComments: comments
        });
    });
})
/* Selecting customer using a button after search */
app.get('/customerSns/:org', ensureAuthenticated, async (req, res, next) => {
    if (req.user.sns) {
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

app.get('/reports', ensureAuthenticated, (req, res, next) => {
    res.render(__dirname + '/public/views/reports.ejs',
        {
            data: req.body,
            sessionUser: req.session.passport.user
        })
})

app.post('/searchReport', ensureAuthenticated, async (req, res, next) => {
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

app.post('/createNewCustomer', ensureAuthenticated, async (req, res, next) => {
    Promise.all([
        await QUERY.addNewCustomer(req.body, req.user.name)
    ]).then(resultArr => {
        res.render(__dirname + '/public/views/newCustomerSuccess.ejs', {
            data: req.body,
            sessionUser: req.session.passport.user
        })
    })
})

app.post('/createHcs/:orgnr', ensureAuthenticated, async (req, res, next) => {
    await new Promise((resolve, reject) => {
        POOL.con.query(`INSERT INTO hcs (orgnr) VALUES ('${req.params.orgnr}');`, (err, result) => {
            if (err) log.error(err);
            resolve(result)
        })
    }).then(() => {
        res.redirect(`/customer/${req.params.orgnr}`)
    })
})

app.post('/addProduct', ensureAuthenticated, async (req, res, next) => {
    await QUERY.addProduct(req.body.company, req)
        .then(() => {
            res.redirect(`/customer/${req.body.company}`)
        }
        )
})

app.post('/addProductSns', ensureAuthenticated, async (req, res, next) => {
    let companyData, productData, numbersData, hcsData;
    SNS.addProductSns(req.body.company, req.user)
        .then(() => {
            Promise.all([
                SNS.getSnsCompany(req.body.company),
                SNS.getSnsProducts(req.body.company),
                SNS.getSnsNumbers(req.body.company),
                SNS.getSnsHcs(req.body.company)
            ]).then(() => {
                res.redirect(`/customer/${req.body.company}`)
            })
        }
        )
})

app.post('/editCustomer', ensureAuthenticated, async (req, res, next) => {
    let companyData, productData, numbersData, hcsData, groups;
    Promise.all([
        await QUERY.getCompany(req.body.company),
        await QUERY.getProducts(req.body.company),
        await QUERY.getNumbers(req.body.company),
        await QUERY.getHcs(req.body.company),
        await QUERY.loadGroups()
    ]).then(resultArr => {
        companyData = resultArr[0][0];
        productData = resultArr[1];
        numbersData = resultArr[2];
        hcsData = resultArr[3];
        groups = resultArr[4];
        res.render(__dirname + '/public/views/editCustomerPage.ejs', {
            companyData: companyData,
            productData: productData,
            numbersData: numbersData,
            hcsData: hcsData,
            sessionUser: req.session.passport.user,
            groups: groups
        })
    })
})
// app.post('/editProduct',ensureAuthenticated, async (req,res,next) => {
//     Promise.all([
//         await getCompany(req.body.company),
//         await getProducts(req.body.company),
//         await getNumbers(req.body.company),
//         await QUERY.getHsc(req.body.company)
//         ]).then(() => {
//             res.redirect(`/customer/${req.body.company}`)
//         })
// })

app.post('/editCustomerSns', ensureAuthenticated, async (req, res, next) => {
    Promise.all([
        await SNS.getSnsCompany(req.body.company),
        await SNS.getSnsProducts(req.body.company),
        await SNS.getSnsHcs(req.body.company)
    ]).then(() => {
        res.redirect(`/customer/${req.body.company}`)
    })
})

app.post('/editHcs', ensureAuthenticated, async (req, res, next) => {
    Promise.all([
        await QUERY.getCompany(req.body.company),
        await QUERY.getProducts(req.body.company),
        await QUERY.getNumbers(req.body.company),
        await QUERY.getHcs(req.body.company)
    ]).then(() => {
        res.redirect(`/customer/${req.body.company}`)

    })
})

app.post('/addComment', ensureAuthenticated, async (req, res) => {
    let data = req.body;
    await QUERY.addComment(data, req).then(
        () => {
            res.redirect(`/customer/${data.company}`)
        }
    )
})

app.post('/deleteComment', ensureAuthenticated, async (req, res) => {
    let data = req.body;
    await QUERY.deleteComment(data, req).then(
        () => {
            res.redirect(`/customer/${data.company}`)
        }
    )
})

app.post('/deleteProduct', ensureAuthenticated, async (req, res) => {
    let data = req.body;
    await QUERY.deleteProduct(data, req).then(
        () => {
            res.redirect(`/customer/${data.company}`)
        }
    )
})

app.post('/updateProduct', ensureAuthenticated, async (req, res) => {
    let data = req.body;
    await QUERY.updateProduct(data, req).then(
        () => {
            res.redirect(`/customer/${data.company}`)
        }
    )
})

app.post('/updateComment', ensureAuthenticated, async (req, res) => {
    let data = req.body;
    await QUERY.updateComment(data, req).then(
        () => {
            res.redirect(`/customer/${data.company}`)
        }
    )
})

app.post('/export', ensureAuthenticated, async (req, res, next) => {
    var fileName = `UC Avtalsdatabas ${new Date().toLocaleString("en-SE").replace(",", "")}.xlsx`;
    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=" + fileName);
    await generateExport(res, req.body);
})

app.post('/saveCustomer', ensureAuthenticated, async (req, res, next) => {
    let data = req.body;
    await QUERY.saveCustomer(data, req).then(
        () => {
            res.redirect(`/customer/${data.company}`)
        }
    )
})

app.post('/saveHcs', ensureAuthenticated, async (req, res, next) => {
    let data = req.body;
    await QUERY.saveHcs(data, req).then(
        () => {
            res.redirect(`/customer/${data.company}`)
        }
    )
})

app.get('/controlpanel', ensureAuthenticated, async function (req, res) {
    await QUERY.loadGroups().then(
        (results) => {
            let groups = results;
            res.render(__dirname + '/public/views/cp/controlpanel.ejs', {
                loadedGroups: groups,
                sessionUser: req.session.passport.user
            });
        }
    )
})

app.post('/addGroup', ensureAuthenticated, async function (req, res) {
    let data = req.body;
    await QUERY.addGroup(data, req).then(
        () => {
            res.redirect('/controlpanel')
        }
    )
})

app.post('/modifyGroup', ensureAuthenticated, async function (req, res) {
    let data = req.body;
    await QUERY.modifyGroup(data, req).then(
        () => {
            res.redirect('/controlpanel')
        }
    )
})

app.get('/errLogin', function (req, res) {
    res.render(__dirname + '/public/views/landing_page.ejs', {
        errorLogin: true,
        messages: req.flash('error')
    })
})

app.get('/logout', function (req, res) {
    if (req.user) {
        log.info('User logged out: ' + req.user.name)
        req.logout();
        res.render(__dirname + '/public/views/landing_page.ejs', { loggedOut: true })
    } else {
        res.render(__dirname + '/public/views/landing_page.ejs')
    }

});

app.get('/locale/:lang', function (req, res) {
    let lang = req.params.lang
    res.clearCookie('locale')
    res.cookie('locale', lang, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true });
    req.setLocale(lang)
    res.redirect('/landing');
})
app.get('/locales/:lang', function (req, res) {
    let lang = req.params.lang
    res.clearCookie('locale')
    res.cookie('locale', lang, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true });
    req.setLocale(lang)
    res.redirect('/');
})



app.get('*', function (req, res) {
    res.render(__dirname + '/public/views/landing_page.ejs', { wrongUrl: true })
})


const suppliedArgs = process.argv.slice(2);


if (suppliedArgs.includes('-dev')) {
    app.listen(CONFIG.PORT, function () {
        console.log(`-- RUNNING IN DEVELOPMENT --`);
        console.log(`Running server on ${CONFIG.PORT}`);
    });
} else {
    app.use(function (err, req, res, next) {
        log.error(err)
        res.status(500);
        res.render(__dirname + '/public/views/error.ejs');
    });
    log.info('Server started, Logger active');
    https.createServer(CONFIG.https_options, app).listen(CONFIG.PORT);
}

