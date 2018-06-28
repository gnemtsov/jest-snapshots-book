const fs = require('fs');
const path = require('path');

module.exports = class SnapshotsBook {
    constructor(globalConfig, options) {
        this._globalConfig = globalConfig;
        this._options = options;

        this.dumpSvg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJmZWF0aGVyIGZlYXRoZXItY2FtZXJhIj48cGF0aCBkPSJNMjMgMTlhMiAyIDAgMCAxLTIgMkgzYTIgMiAwIDAgMS0yLTJWOGEyIDIgMCAwIDEgMi0yaDRsMi0zaDZsMiAzaDRhMiAyIDAgMCAxIDIgMnoiPjwvcGF0aD48Y2lyY2xlIGN4PSIxMiIgY3k9IjEzIiByPSI0Ij48L2NpcmNsZT48L3N2Zz4=';
    }

    log(message) {
        console.log(message);
    }

    getHTMLPage(title, css, content) {
        return `
            <!doctype html>
            <html lang="en">
                <head>
                    <meta charset="utf-8">
                    <title>${title}</title>
                    <style>${css}</style>
                </head>
                <body>
                    ${content}
                </body>
            </html>
        `;
    }

    grabCSS(moduleName, css = [], level = 0) {
        const tab = '  ';
        let indent = '';
        for (var i = 0; i < level; i++) {
            indent += tab;
        }

        let src = '';
        try {
            src = fs.readFileSync(moduleName, 'utf8');
            this.log(`${indent}--> Opened module ${path.basename(moduleName)}`);
        } catch (e) {
            this.log(`${indent}--x Failed to open module ${path.basename(moduleName)}`);
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
                        this.log(`${indent}--> Grabed css file ${path.basename(fileName)}`);
                    } catch (e) {
                        this.log(`${indent}--x Failed to open css file ${path.basename(fileName)}`);
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
        let toc = [];

        const bookDir = 'snapshots-book';
        try {
            fs.mkdirSync(bookDir);
        } catch (e) {
            if (e.code !== 'EEXIST') {
                throw (e);
            }
        }

        for (const { testFilePath } of results.testResults) {
            const { dir, base } = path.parse(testFilePath);
            const [, name] = /^(.+)\.(test|spec)\.(js|jsx)$/i.exec(base);

            if (name === undefined) {
                console.log(`File name can't be parsed for test file: ${testFilePath}`);
                break;
            }

            const css = this.grabCSS(testFilePath);

            let snapshots = {};
            try {
                const snap = fs.readFileSync(path.join(dir, '__snapshots__', `${base}.snap`), 'utf8');
                // eslint-disable-next-line no-new-func
                const populate = new Function('exports', snap);
                populate(snapshots);
            } catch (e) { }

            const tests = Object.keys(snapshots);
            if (tests.length) {
                let content = tests.map(
                    test =>
                        `
                        <div style="margin-top: 1.5rem; border-top: 4px dashed red;">
                            <div style="background-color: #f38787; padding: 0.6rem; margin-bottom: 0.6rem;">${test}</div>\n
                            ${snapshots[test]
                            .replace(/src=".+"/g, `src="${this.dumpSvg}"`)
                            .replace(/className="/g, `class="`)}
                        </div>
                    `
                ).join('\n\n');

                fs.writeFileSync(path.join(bookDir, `${base}.html`), this.getHTMLPage(name, css.join(''), content));
                toc.push({ base, name });
            } else {
                try {
                    fs.unlinkSync(path.join(bookDir, `${base}.html`));
                } catch (e) { }
            }
        }

        if (toc.length) {
            let content = `
                   <h1>The book of snapshots</h1>\n
                   <h3 style="background-color: #d6cfcf; padding: 0.6rem;">Table of contents</h3>\n
                   ${toc.map(t => `<div style="font-size: 1.2rem; margin-left: 1rem;"><a href="${t.base}.html">${t.name}</a></div>\n`)}
               `;
            fs.writeFileSync(path.join(bookDir, 'index.html'), this.getHTMLPage('The book of snapshots', '', content));
        } else {
            fs.writeFileSync(path.join(bookDir, 'index.html'), 'No snapshots found.');
        }
    }

    getLastError() {
        if (this._shouldFail) {
            return new Error('snapshots-book error');
        }
    }
}