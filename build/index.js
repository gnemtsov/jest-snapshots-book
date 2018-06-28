'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var fs = require('fs');
var path = require('path');

module.exports = function () {
    function SnapshotsBook(globalConfig, options) {
        _classCallCheck(this, SnapshotsBook);

        this._globalConfig = globalConfig;
        this._options = options;

        this.dumpSvg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJmZWF0aGVyIGZlYXRoZXItY2FtZXJhIj48cGF0aCBkPSJNMjMgMTlhMiAyIDAgMCAxLTIgMkgzYTIgMiAwIDAgMS0yLTJWOGEyIDIgMCAwIDEgMi0yaDRsMi0zaDZsMiAzaDRhMiAyIDAgMCAxIDIgMnoiPjwvcGF0aD48Y2lyY2xlIGN4PSIxMiIgY3k9IjEzIiByPSI0Ij48L2NpcmNsZT48L3N2Zz4=';
    }

    _createClass(SnapshotsBook, [{
        key: 'log',
        value: function log(message) {
            console.log(message);
        }
    }, {
        key: 'getHTMLPage',
        value: function getHTMLPage(title, css, content) {
            return '\n            <!doctype html>\n            <html lang="en">\n                <head>\n                    <meta charset="utf-8">\n                    <title>' + title + '</title>\n                    <style>' + css + '</style>\n                </head>\n                <body>\n                    ' + content + '\n                </body>\n            </html>\n        ';
        }
    }, {
        key: 'grabCSS',
        value: function grabCSS(moduleName) {
            var css = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
            var level = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

            var tab = '  ';
            var indent = '';
            for (var i = 0; i < level; i++) {
                indent += tab;
            }

            var src = '';
            try {
                src = fs.readFileSync(moduleName, 'utf8');
                this.log(indent + '--> Opened module ' + path.basename(moduleName));
            } catch (e) {
                this.log(indent + '--x Failed to open module ' + path.basename(moduleName));
            }

            if (src !== '') {
                indent += tab;
                var importReg = /import.+?from\s+['"](.+?)['"]/ig;
                var result = void 0;
                while (true) {
                    result = importReg.exec(src);
                    if (result === null) {
                        break;
                    }

                    var fileName = path.resolve(path.dirname(moduleName), result[1]);
                    var ext = path.extname(fileName);
                    if (ext === '.css') {
                        var cssSrc = '';
                        try {
                            cssSrc = fs.readFileSync(fileName, 'utf8');
                            this.log(indent + '--> Grabed css file ' + path.basename(fileName));
                        } catch (e) {
                            this.log(indent + '--x Failed to open css file ' + path.basename(fileName));
                        }
                        css.push(cssSrc);
                    } else {
                        css = this.grabCSS(fileName + (ext ? '' : '.js'), css, level + 1);
                    }
                }
            }
            return css;
        }
    }, {
        key: 'onRunComplete',
        value: function onRunComplete(contexts, results) {
            var _this = this;

            var toc = [];

            var bookDir = 'snapshots-book';
            try {
                fs.mkdirSync(bookDir);
            } catch (e) {
                if (e.code !== 'EEXIST') {
                    throw e;
                }
            }

            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                var _loop = function _loop() {
                    var testFilePath = _step.value.testFilePath;

                    var _path$parse = path.parse(testFilePath),
                        dir = _path$parse.dir,
                        base = _path$parse.base;

                    var _$exec = /^(.+)\.(test|spec)\.(js|jsx)$/i.exec(base),
                        _$exec2 = _slicedToArray(_$exec, 2),
                        name = _$exec2[1];

                    if (name === undefined) {
                        console.log('File name can\'t be parsed for test file: ' + testFilePath);
                        return 'break';
                    }

                    var css = _this.grabCSS(testFilePath);

                    var snapshots = {};
                    try {
                        var snap = fs.readFileSync(path.join(dir, '__snapshots__', base + '.snap'), 'utf8');
                        // eslint-disable-next-line no-new-func
                        var populate = new Function('exports', snap);
                        populate(snapshots);
                    } catch (e) {}

                    var tests = Object.keys(snapshots);
                    if (tests.length) {
                        var _content = tests.map(function (test) {
                            return '\n                        <div style="margin-top: 1.5rem; border-top: 4px dashed red;">\n                            <div style="background-color: #f38787; padding: 0.6rem; margin-bottom: 0.6rem;">' + test + '</div>\n\n                            ' + snapshots[test].replace(/src=".+"/g, 'src="' + _this.dumpSvg + '"').replace(/className="/g, 'class="') + '\n                        </div>\n                    ';
                        }).join('\n\n');

                        fs.writeFileSync(path.join(bookDir, base + '.html'), _this.getHTMLPage(name, css.join(''), _content));
                        toc.push({ base: base, name: name });
                    } else {
                        try {
                            fs.unlinkSync(path.join(bookDir, base + '.html'));
                        } catch (e) {}
                    }
                };

                for (var _iterator = results.testResults[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    var _ret = _loop();

                    if (_ret === 'break') break;
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion && _iterator.return) {
                        _iterator.return();
                    }
                } finally {
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }

            if (toc.length) {
                var content = '\n                   <h1>The book of snapshots</h1>\n\n                   <h3 style="background-color: #d6cfcf; padding: 0.6rem;">Table of contents</h3>\n\n                   ' + toc.map(function (t) {
                    return '<div style="font-size: 1.2rem; margin-left: 1rem;"><a href="' + t.base + '.html">' + t.name + '</a></div>\n';
                }) + '\n               ';
                fs.writeFileSync(path.join(bookDir, 'index.html'), this.getHTMLPage('The book of snapshots', '', content));
            } else {
                fs.writeFileSync(path.join(bookDir, 'index.html'), 'No snapshots found.');
            }
        }
    }, {
        key: 'getLastError',
        value: function getLastError() {
            if (this._shouldFail) {
                return new Error('snapshots-book error');
            }
        }
    }]);

    return SnapshotsBook;
}();