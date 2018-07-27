//TODO adjust iframe height by content height (see https://stackoverflow.com/a/23020025/1858818).
//TODO highlight changed lines in raw format
//TODO indent table contents to reflect component hierarchy

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

module.exports = class SnapshotsBook {
    constructor(globalConfig, options) {
        this._globalConfig = globalConfig;
        this._options = options;

        this.verbose = Boolean(this._options.verbose);

        this.bookDir = 'snapshots-book';
        this.mainCss = `
            .TOCContainer a{
                display:block;
                font-size: 1.2rem; 
                margin-left: 1rem;
            }

            .SubHeader{ padding: 0.6rem; background-color: #d1d1d1; }
            .Filters span { margin-left: 1rem; }

            .TestResultContainer{ margin-top: 1.5rem; }
            .TestResultContainer.passed .TestHeader{ padding: 0.6rem; background-color: #99e99b; }
            .TestResultContainer.failed .TestHeader{ padding: 0.6rem; background-color: #ff9f9f; }
            .TestResult{
                display: flex;
                justify-content: space-around;                
            }

            .ExpectedContainer, .ActualContainer {
                padding: 0.6rem;
                width: 100%;
            }
            .ExpectedHeader, .ActualHeader { color: #4c4c4c; }
            .ExpectedContainer iframe, .ActualContainer iframe{
                width: 100%;
                height: 350px;
                border: 1px solid #beb6b6;
            }
        `;
        this.mainJs = `
            document.addEventListener("DOMContentLoaded", function(){
                document.getElementById('show-all').addEventListener("click", function(e) {
                    e.preventDefault();
                    var resultContainers = document.getElementsByClassName("TestResultContainer");
                    for (var i = 0; i < resultContainers.length; ++i) {
                        var el = resultContainers[i];
                        el.style.display = 'block';
                    }                    
                });

                document.getElementById('show-passed').addEventListener("click", function(e) {
                    e.preventDefault();
                    var resultContainers = document.getElementsByClassName("TestResultContainer");
                    for (var i = 0; i < resultContainers.length; ++i) {
                        var el = resultContainers[i];
                        if(el.classList.contains('passed')){
                            el.style.display = 'block';
                        } else {
                            el.style.display = 'none';
                        }
                    }                    
                });

                document.getElementById('show-failed').addEventListener("click", function(e) {
                    e.preventDefault();
                    var resultContainers = document.getElementsByClassName("TestResultContainer");
                    for (var i = 0; i < resultContainers.length; ++i) {
                        var el = resultContainers[i];
                        if(el.classList.contains('failed')){
                            el.style.display = 'block';
                        } else {
                            el.style.display = 'none';
                        }
                    };
                });               
            });
        `;
    }

    log(message) {
        if (this.verbose) {
            console.log(message);
        }
    }

    getHTMLPage(title = '', css = '', js = '', content = '') {
        return `
            <!doctype html>
            <html lang="en">
                <head>
                    <meta charset="utf-8">
                    <title>${title}</title>
                    <style>${css}</style>
                    <script>${js}</script>
                </head>
                <body>${content}</body>
            </html>
        `;
    }

    mkDirByPathSync(dir) {
        const sep = path.sep;
        const initDir = path.isAbsolute(dir) ? sep : '';

        dir.split(sep).reduce((parentDir, childDir) => {
            const curDir = path.resolve('.', parentDir, childDir);
            if (!fs.existsSync(curDir)) {
                fs.mkdirSync(curDir);
            }
            return curDir;
        }, initDir);
    }

    emptyDirSync(dir, level = 0) {
        if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach(file => {
                const curPath = path.join(dir, file);
                if (fs.lstatSync(curPath).isDirectory()) {
                    this.emptyDirSync(curPath, level + 1);
                } else {
                    try {
                        fs.unlinkSync(curPath);
                    } catch (err) { }
                }
            });
            if (level > 0) {
                try {
                    fs.rmdirSync(dir);
                } catch (err) { }
            }
        }
    }

    grabCSS(moduleName, css = [], level = 0) {
        const tab = '  ';
        let indent = tab;
        for (var i = 0; i < level; i++) {
            indent += tab;
        }

        let src = '';
        try {
            src = fs.readFileSync(moduleName, 'utf8');
            if (level === 0) {
                this.log(`${indent}--> Opened module ${path.basename(moduleName)}`);
            } else {
                this.log(`${indent}--> Opened module ${path.basename(moduleName)}`);
            }
        } catch (e) {
            this.log(chalk.gray(`${indent}--х Failed to open module ${path.basename(moduleName)}`));
        }

        if (src !== '') {
            indent += tab;
            let importReg = /import.+?from\s+['"](.+?)['"]/ig;
            let result;
            while (true) {
                result = importReg.exec(src);
                if (result === null) {
                    break;
                }

                const fileName = path.resolve(path.dirname(moduleName), result[1]);
                const ext = path.extname(fileName);
                if (ext === '.css') {
                    let cssSrc = '';
                    try {
                        cssSrc = fs.readFileSync(fileName, 'utf8');
                        this.log(`${indent}--> Grabed css file ${chalk.green(path.basename(fileName))}`);
                    } catch (e) {
                        this.log(`${indent}--х Failed to open css file ${chalk.red(path.basename(fileName))}`);
                    }
                    css.push(cssSrc);
                } else {
                    css = this.grabCSS(fileName + (ext ? '' : '.js'), css, level + 1);
                }
            }
        }
        return css;
    }

    onRunComplete(contexts, results) {
        this.log('\nJest-snapshots-book reporter is running...\n');
        this.mkDirByPathSync(this.bookDir);

        let toc = [];

        let iFrameContentCss = `
            .LNum {
                color: #666;
                margin: 0 1rem 0 0.5rem;
            }
            .yellow {
                color: #d5a207;
                font-weight: bold;
            }
            .green { color: green; }
            .red { color: red; }
        `;
        const cssForRawAndDiff = `
            body {
                font-family: monospace;
                white-space: pre;
            }
        `;
        const iFrameContentJS = nextPage => `
            document.addEventListener("click", function() {
                location = "${nextPage}";
            });
        `;

        for (let { testFilePath, testResults } of results.testResults) {
            const { dir, base } = path.parse(testFilePath);
            const [, name] = /^(.+)\.(test|spec)\.(js|jsx)$/i.exec(base);

            if (name === undefined) {
                console.log(`File name can't be parsed for test file: ${testFilePath}`);
                break;
            }

            this.log(`Process test file ${chalk.bgGreen.black(base)}`);

            //Clear dir
            const testResultPagePath = path.join(this.bookDir, name);
            this.emptyDirSync(testResultPagePath);
            this.mkDirByPathSync(testResultPagePath);

            //CSS of IFrame content (contains grabbed css + additional styles)
            this.log('Grab styles');
            iFrameContentCss =
                this.grabCSS(testFilePath)
                    .concat([iFrameContentCss])
                    .join('');

            //populate snapshots from *.snap file
            this.log(`Populate snapshots from ${base}.snap`);
            let snapshots = {};
            try {
                const snap = fs.readFileSync(path.join(dir, '__snapshots__', `${base}.snap`), 'utf8');
                // eslint-disable-next-line no-new-func
                const populate = new Function('exports', snap);
                populate(snapshots);
            } catch (e) { }

            //make expected, actual snapshots and diff
            this.log('Prepare expected and actual');
            let testResultContainers = [];
            const snapshotsKeys = Object.keys(snapshots);
            let counters = {
                _total: 0,
                get total() { return this._total.toString(); },
                set total(v) { return this._total = v; },
                _passed: 0,
                get passed() { return this._passed.toString(); },
                set passed(v) { return this._passed = v; },
                _failed: 0,
                get failed() { return this._failed.toString(); },
                set failed(v) { return this._failed = v; }
            }
            testResults.forEach(result => {
                const keyRegExp = new RegExp(`^${result.fullName} \\d+$`);
                const key = snapshotsKeys.find(k => keyRegExp.test(k));
                if (key === undefined) {
                    return;
                }

                counters.total++;
                result.expected = snapshots[key].trim().split('\n');

                if (result.status === 'failed') {
                    counters.failed++;
                    result.diffs = [];
                    result.actual = [];
                    result.failureMessages.forEach(message => {
                        const ansiColorsStylesPattern = [
                            '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[a-zA-Z\\d]*)*)?\\u0007)',
                            '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PRZcf-ntqry=><~]))'
                        ].join('|');
                        message = message.replace(new RegExp(ansiColorsStylesPattern, 'g'), '');
                        let lines = message.split('\n');

                        //make actual and diff out of failure message                        
                        let expPassed = 0;
                        let expStart = 0;
                        let expCount = 0;
                        let actStart = 0;
                        let actCount = 0;
                        let newBlock = [];
                        let isInsideBlock = false;
                        lines = lines.reduce((accumulator, line) => {
                            if (newBlock.length > 0 && newBlock.length === actCount) {
                                const toAppend = result.expected
                                    .slice(expPassed, expStart)
                                    .concat(newBlock);
                                result.actual = result.actual.concat(toAppend);

                                expPassed = expStart + expCount;
                                expStart = 0;
                                expCount = 0;
                                actStart = 0;
                                actCount = 0;
                                newBlock = [];
                                isInsideBlock = false;
                            }

                            const regexpResult = /@@ -(\d+),(\d+) \+(\d+),(\d+) @@/.exec(line);
                            if (regexpResult) {
                                [, expStart, expCount, actStart, actCount] = regexpResult;
                                expStart = Number(expStart) - 1;
                                expCount = Number(expCount);
                                actStart = Number(actStart) - 1;
                                actCount = Number(actCount);
                                isInsideBlock = true;
                            }

                            if (isInsideBlock) {
                                if (!/^@@|-/.test(line)) {
                                    newBlock.push(line.replace(/^\+/, ''));
                                }
                                accumulator.push(line);
                            }
                            return accumulator;
                        }, []);
                        const toAppend = result.expected.slice(expPassed, result.expected.length - 1);
                        result.actual = result.actual.concat(toAppend);
                        result.diffs = result.diffs.concat(lines);
                    });
                } else {
                    counters.passed++;
                }

                //prepare path for results
                const testPath = path.join(this.bookDir, name, counters.total);
                this.mkDirByPathSync(testPath);

                //-----> output expected
                fs.writeFile(
                    path.join(testPath, 'expectedHtml.html'),
                    this.getHTMLPage(
                        name,
                        iFrameContentCss,
                        iFrameContentJS('expectedRaw.html'),
                        result.expected.join('\n')
                    )
                );

                fs.writeFile(
                    path.join(testPath, 'expectedRaw.html'),
                    this.getHTMLPage(
                        name,
                        iFrameContentCss + cssForRawAndDiff,
                        iFrameContentJS('expectedHtml.html'),
                        result.expected.map((line, i) => {
                            const num = i + 1;
                            line = line.replace(/[\u00A0-\u9999<>\&]/gim, i => `&#${i.charCodeAt(0)}`);
                            return `<span class="LNum">${num}</span>${line}`;
                        }).join('</br>')
                    )
                );

                let expectedContainerHtml = `
                    <div class="ExpectedContainer">
                        <div class="ExpectedHeader">${result.status === 'failed' ? 'Expected' : ''}</div>
                        <iframe src="${counters.total}/expectedHtml.html">
                            Browser should support iframes.
                        </iframe>
                    </div>
                `;

                //-----> output actual
                let actualContainerHtml = '';
                if (result.status === 'failed') {
                    fs.writeFile(
                        path.join(testPath, 'actualHtml.html'),
                        this.getHTMLPage(
                            name,
                            iFrameContentCss,
                            iFrameContentJS('actualRaw.html'),
                            result.actual.join('\n')
                        )
                    );

                    fs.writeFile(
                        path.join(testPath, 'actualRaw.html'),
                        this.getHTMLPage(
                            name,
                            iFrameContentCss + cssForRawAndDiff,
                            iFrameContentJS('actualDiff.html'),
                            result.actual.map((line, i) => {
                                const num = i + 1;
                                line = line.replace(/[\u00A0-\u9999<>\&]/gim, i => `&#${i.charCodeAt(0)}`);
                                return `<span class="LNum">${num}</span>${line}`;
                            }).join('</br>')
                        )
                    );

                    fs.writeFile(
                        path.join(testPath, 'actualDiff.html'),
                        this.getHTMLPage(
                            name,
                            iFrameContentCss + cssForRawAndDiff,
                            iFrameContentJS('actualHtml.html'),
                            result.diffs.map(line => {
                                let lineClass = '';
                                if (/^@@ -\d+,\d+ \+\d+,\d+ @@$/.test(line)) {
                                    lineClass = 'yellow';
                                } else if (/^-/.test(line)) {
                                    lineClass = 'green';
                                } else if (/^\+/.test(line)) {
                                    lineClass = 'red';
                                }
                                line = line.replace(/[\u00A0-\u9999<>\&]/gim, i => `&#${i.charCodeAt(0)}`);
                                return `<span class="${lineClass}">${line}</span>`;
                            }).join('</br>')
                        )
                    );

                    actualContainerHtml = `
                        <div class="ActualContainer">
                            <div class="ActualHeader">Actual</div>
                            <iframe src="${counters.total}/actualHtml.html">
                                Browser should support iframes.
                            </iframe>                
                        </div>
                    `;
                }

                //add iframes in testResultContainers
                testResultContainers.push(`
                    <div class="TestResultContainer ${result.status}">
                        <div class="TestHeader">${result.title}</div>
                        <div class="TestResult">
                            ${expectedContainerHtml}
                            ${actualContainerHtml}
                        </div>
                    </div>
                `);

            });

            //-----> output index.html with all testResultContainers
            this.log(`Write page with test results to ${path.join(testResultPagePath, 'index.html')}\n`);
            const html = `
                <div><a href="../index.html">Table of contents</a></div>
                <h1>${name}</h1>
                <div class="Filters">
                    Show 
                    <span><a id="show-all" href="#">all</a>(${counters.total})</span>
                    <span><a id="show-passed" href="#">passed</a>(${counters.passed})</span>
                    <span><a id="show-failed" href="#">failed</a>(${counters.failed})</span>
                </div>
                ${testResultContainers.join('\n')}
            `;

            fs.writeFile(
                path.join(testResultPagePath, 'index.html'),
                this.getHTMLPage(
                    name,
                    this.mainCss,
                    this.mainJs,
                    html
                )
            );

            toc.push({ base, name });
        }

        //-----> output table of contents
        this.log(`Write TOC to ${path.join(this.bookDir, 'index.html')}\n`);
        if (toc.length) {
            let html = `
                    <h1>The book of snapshots</h1>\n
                    <h3 class="SubHeader">Table of contents</h3>\n
                    <div class="TOCContainer">\n
                        ${toc
                    .sort((a, b) => a.name > b.name ? 1 : (a.name < b.name ? -1 : 0))
                    .map(t => `<a href="${t.name}/index.html">${t.name}</a>`)
                    .join('\n')}
                    </div>
               `;
            fs.writeFile(
                path.join(this.bookDir, 'index.html'),
                this.getHTMLPage(
                    'The book of snapshots',
                    this.mainCss,
                    null,
                    html
                )
            );
        } else {
            fs.writeFile(
                path.join(this.bookDir, 'index.html'),
                'No snapshots found.'
            );
        }

        this.log('Jest-snapshots-book finished.');
    }

    getLastError() {
        if (this._shouldFail) {
            return new Error('snapshots-book error');
        }
    }
}