const fs = require('fs');

module.exports = class SnapshotsBook {

    constructor(globalConfig, options) {
        this._globalConfig = globalConfig;
        this._options = options;

        this.dumpSvg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJmZWF0aGVyIGZlYXRoZXItY2FtZXJhIj48cGF0aCBkPSJNMjMgMTlhMiAyIDAgMCAxLTIgMkgzYTIgMiAwIDAgMS0yLTJWOGEyIDIgMCAwIDEgMi0yaDRsMi0zaDZsMiAzaDRhMiAyIDAgMCAxIDIgMnoiPjwvcGF0aD48Y2lyY2xlIGN4PSIxMiIgY3k9IjEzIiByPSI0Ij48L2NpcmNsZT48L3N2Zz4=';
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

    onRunComplete(contexts, results) {
        let toc = [];
        const dir = 'snapshots-book';
        try {
            fs.mkdirSync(dir);
        } catch (e) {
            if (e.code !== 'EEXIST') {
                throw (e);
            }
        }

        for (const { testFilePath } of results.testResults) {
            const [, path, file] = /^(.+)\\(.+)$/i.exec(testFilePath);
            const [, name] = /^(.+)\.(test|spec)\.(js|jsx)$/i.exec(file);

            let css;
            try {
                css = fs.readFileSync(`${path}\\${name}.css`, 'utf8');
            } catch (e) {
                css = '';
            }

            let snapshots = {};
            try {
                const snap = fs.readFileSync(`${path}\\__snapshots__\\${file}.snap`, 'utf8');
                // eslint-disable-next-line no-new-func
                const populate = new Function('exports', snap);
                populate(snapshots);
            } catch (e) { }

            const tests = Object.keys(snapshots);
            if (tests.length) {
                let content = tests.map(
                    test => `
                        <div style="margin-top: 1.5rem; border-top: 4px dashed red;">
                            <div style="background-color: #f38787; padding: 0.6rem;">${test}</div>\n
                            ${snapshots[test]
                                .replace(/src=".+"/g, `src="${this.dumpSvg}"`)
                                .replace(/className="/g, `class="`)}
                        </div>
                    `).join('\n\n');

                fs.writeFileSync(`${dir}/${file}.html`, this.getHTMLPage(name, css, content));
                toc.push({ file, name });
            } else {
                try {
                    fs.unlinkSync(`${dir}/${file}.html`);
                } catch (e) { }
            }
        }

        if (toc.length) {
            let content = `
                <h1>The book of snapshots</h1>\n
                <h3 style="background-color: #d5cfcf; padding: 0.6rem;">Table of contents</h3>\n
                ${toc.map(t => `<div style="font-size: 1.2rem; margin-left: 1rem;"><a href="${t.file}.html">${t.name}</a></div>\n`)}
            `;
            fs.writeFileSync(`${dir}/index.html`, this.getHTMLPage('The book of snapshots', '', content));
        } else {
            fs.writeFileSync(`${dir}/index.html`, 'No snapshots found.');
        }
    }

    getLastError() {
        if (this._shouldFail) {
            return new Error('snapshots-book error');
        }
    }
}