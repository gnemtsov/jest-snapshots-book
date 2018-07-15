//TODO adjust iframe height by content height (see https://stackoverflow.com/a/23020025/1858818).
//TODO add filter to show only passed|failed snapshots

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

module.exports = class SnapshotsBook {
    constructor(globalConfig, options) {
        this._globalConfig = globalConfig;
        this._options = options;

        this.verbose = Boolean(this._options.verbose);
        this.bookDir = 'snapshots-book';
        //        this.dumpSvg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJmZWF0aGVyIGZlYXRoZXItY2FtZXJhIj48cGF0aCBkPSJNMjMgMTlhMiAyIDAgMCAxLTIgMkgzYTIgMiAwIDAgMS0yLTJWOGEyIDIgMCAwIDEgMi0yaDRsMi0zaDZsMiAzaDRhMiAyIDAgMCAxIDIgMnoiPjwvcGF0aD48Y2lyY2xlIGN4PSIxMiIgY3k9IjEzIiByPSI0Ij48L2NpcmNsZT48L3N2Zz4=';
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
                <body>
                    ${content}
                </body>
            </html>
        `;
    }

    getMainCSS() {
        return `
            .TOCContainer a{
                display:block;
                font-size: 1.2rem; 
                margin-left: 1rem;
            }

            .SubHeader{ padding: 0.6rem; background-color: #d1d1d1; }

            .TestResultContainer{ margin-top: 1.5rem; }
            .TestHeader.passed{ padding: 0.6rem; background-color: #99e99b; }
            .TestHeader.failed{ padding: 0.6rem; background-color: #ff9f9f; }
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
    }

    mkDirByPathSync(dir) {
        const sep = path.sep;
        const initDir = path.isAbsolute(dir) ? sep : '';

        dir.split(sep).reduce((parentDir, childDir) => {
            const curDir = path.resolve('.', parentDir, childDir);
            try {
                fs.mkdirSync(curDir);
            } catch (err) {
                if (err.code !== 'EEXIST') {
                    throw err;
                }
            }
            return curDir;
        }, initDir);
    }

    emptyDirSync(dir) {
        if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach(file => {
                const curPath = path.join(dir, file);
                if (fs.lstatSync(curPath).isDirectory()) {
                    this.emptyDirSync(curPath);
                } else {
                    fs.unlinkSync(curPath);
                }
            });
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

    onTestResult(test, testResult, aggregatedResult) {
        //    fs.writeFileSync(path.join(this.bookDir, `test.json`), JSON.stringify(test));
        //    fs.writeFileSync(path.join(this.bookDir, `testResult.json`), JSON.stringify(testResult));
        //    fs.writeFileSync(path.join(this.bookDir, `aggregatedResult.json`), JSON.stringify(aggregatedResult));
    }

    onRunComplete(contexts, results) {
        this.log('\nJest-snapshots-book reporter is running...\n');

        let toc = [];

        try {
            fs.mkdirSync(this.bookDir);
        } catch (e) {
            if (e.code !== 'EEXIST') {
                throw (e);
            }
        }

        this.emptyDirSync(this.bookDir);

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
            #html-container { display: block; }
            #raw-container, #diff-container {
                display: none;
                font-family: monospace;
                white-space: pre;
            }
        `;
        const iFrameContentJSExpected = `
            document.addEventListener("click", function() {
                var htmlContainer = document.getElementById('html-container');
                var rawContainer = document.getElementById('raw-container');
                if(rawContainer.style.display === 'block'){
                    htmlContainer.style.display = 'block';
                    rawContainer.style.display = 'none';
                } else if (htmlContainer.style.display === 'block' || htmlContainer.style.display === ''){
                    htmlContainer.style.display = 'none';
                    rawContainer.style.display = 'block';
                }
            });
        `;
        const iFrameContentJSActual = `
            document.addEventListener("click", function() {
                var htmlContainer = document.getElementById('html-container');
                var rawContainer = document.getElementById('raw-container');
                var diffContainer = document.getElementById('diff-container');
                if(diffContainer.style.display === 'block'){
                    htmlContainer.style.display = 'block';
                    rawContainer.style.display = 'none';
                    diffContainer.style.display = 'none';
                } else if (htmlContainer.style.display === 'block' || htmlContainer.style.display === ''){
                    htmlContainer.style.display = 'none';
                    rawContainer.style.display = 'block';
                    diffContainer.style.display = 'none';
                } else if(rawContainer.style.display === 'block'){
                    htmlContainer.style.display = 'none';
                    rawContainer.style.display = 'none';
                    diffContainer.style.display = 'block';
                }
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
            let testCounter = 0;
            testResults.forEach(result => {
                const keyRegExp = new RegExp(`^${result.fullName} \\d+$`);
                const key = snapshotsKeys.find(k => keyRegExp.test(k));
                if (key === undefined) {
                    return;
                }

                testCounter++;
                result.expected = snapshots[key].trim().split('\n');

                if (result.status === 'failed') {
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
                }

                //prepare path for results
                const testPath = path.join(this.bookDir, name, testCounter.toString());
                this.mkDirByPathSync(testPath);


                //-----> output expected
                const expHtml = `
                    <div id="html-container">${result.expected.join('\n')}</div>
                    <div id="raw-container">${result.expected.map((line, i) => {
                        const num = i + 1;
                        line = line.replace(/[\u00A0-\u9999<>\&]/gim, i => `&#${i.charCodeAt(0)}`);
                        return `<span class="LNum">${num}</span>${line}`;
                    }).join('</br>')
                    }</div>
                `;

                fs.writeFileSync(
                    path.join(testPath, 'expected.html'),
                    this.getHTMLPage(name, iFrameContentCss, iFrameContentJSExpected, expHtml)
                );

                let expectedContainerHtml = `
                    <div class="ExpectedContainer">
                        <div class="ExpectedHeader">${result.status === 'failed' ? 'Expected' : ''}</div>
                        <iframe src="${testCounter}/expected.html">
                            Browser should support iframes.
                        </iframe>
                    </div>
                `;

                //-----> output actual
                let actualContainerHtml = '';
                if (result.status === 'failed') {
                    const actHtml = `
                        <div id="html-container">${result.actual.join('\n')}</div>
                        <div id="raw-container">${result.actual.map((line, i) => {
                            const num = i + 1;
                            line = line.replace(/[\u00A0-\u9999<>\&]/gim, i => `&#${i.charCodeAt(0)}`);
                            return `<span class="LNum">${num}</span>${line}`;
                        }).join('</br>')
                        }</div>
                        <div id="diff-container">${result.diffs.map(line => {
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
                        }</div>
                    `;

                    fs.writeFileSync(
                        path.join(testPath, 'actual.html'),
                        this.getHTMLPage(name, iFrameContentCss, iFrameContentJSActual, actHtml)
                    );

                    actualContainerHtml = `
                        <div class="ActualContainer">
                            <div class="ActualHeader">Actual</div>
                            <iframe src="${testCounter}/actual.html">
                                Browser should support iframes.
                            </iframe>                
                        </div>
                    `;
                }

                //add iframes in testResultContainers
                testResultContainers.push(`
                    <div class="TestResultContainer">
                        <div class="TestHeader ${result.status}">${result.title}</div>
                        <div class="TestResult">
                            ${expectedContainerHtml}
                            ${actualContainerHtml}
                        </div>
                    </div>
                `);

            });

            //-----> output index.html with all testResultContainers
            const testResultPagePath = path.join(this.bookDir, name, `index.html`);
            this.log(`Write page with test results to ${testResultPagePath}`);
            const html = `
                <h3>${name}</h3>
                ${testResultContainers.join('\n')}
            `;

            fs.writeFileSync(
                testResultPagePath,
                this.getHTMLPage(name, this.getMainCSS(), null, html)
            );

            toc.push({ base, name });

            /*             const tests = Object.keys(snapshots);
                        if (tests.length) {
                            content += tests.map(
                                test => `
                                    <div style="margin-top: 1.5rem;">
                                        <div style="background-color: #d6cfcf; padding: 0.6rem; margin-bottom: 0.6rem;">${test}</div>\n
                                        ${snapshots[test]
                                        .replace(/src=".+"/g, `src="${this.dumpSvg}"`)
                                        .replace(/className="/g, `class="`)}
                                    </div>
                                `
                            ).join('\n\n');
            
                            fs.writeFileSync(path.join(this.bookDir, `${base}.html`), this.getHTMLPage(name, css.join(''), content));
                        } else {
                            try {
                                fs.unlinkSync(path.join(this.bookDir, `${base}.html`));
                            } catch (e) { }
                        }
             */
        }

        //-----> output table of contents
        const tocPagePath = path.join(this.bookDir, 'index.html');
        this.log(`\nWrite TOC to ${tocPagePath}\n`);
        if (toc.length) {
            let content = `
                    <h1>The book of snapshots</h1>\n
                    <h3 class="SubHeader">Table of contents</h3>\n
                    <div class="TOCContainer">\n
                        ${toc.map(t => `<a href="${t.name}/index.html">${t.name}</a>\n`)}
                    </div>
               `;
            fs.writeFileSync(tocPagePath, this.getHTMLPage('The book of snapshots', this.getMainCSS(), null, content));
        } else {
            fs.writeFileSync(tocPagePath, 'No snapshots found.');
        }

        this.log('Jest-snapshots-book finished.');
    }

    getLastError() {
        if (this._shouldFail) {
            return new Error('snapshots-book error');
        }
    }
}