'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var fs = require('fs');

module.exports = function () {
    function SnapshotsBook(globalConfig, options) {
        _classCallCheck(this, SnapshotsBook);

        this._globalConfig = globalConfig;
        this._options = options;

        this.dumpSvg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJmZWF0aGVyIGZlYXRoZXItY2FtZXJhIj48cGF0aCBkPSJNMjMgMTlhMiAyIDAgMCAxLTIgMkgzYTIgMiAwIDAgMS0yLTJWOGEyIDIgMCAwIDEgMi0yaDRsMi0zaDZsMiAzaDRhMiAyIDAgMCAxIDIgMnoiPjwvcGF0aD48Y2lyY2xlIGN4PSIxMiIgY3k9IjEzIiByPSI0Ij48L2NpcmNsZT48L3N2Zz4=';
    }

    _createClass(SnapshotsBook, [{
        key: 'getHTMLPage',
        value: function getHTMLPage(title, css, content) {
            return '\n            <!doctype html>\n            <html lang="en">\n                <head>\n                    <meta charset="utf-8">\n                    <title>' + title + '</title>\n                    <style>' + css + '</style>\n                </head>\n                <body>\n                    ' + content + '\n                </body>\n            </html>\n        ';
        }
    }, {
        key: 'onRunComplete',
        value: function onRunComplete(contexts, results) {
            var _this = this;

            var toc = [];
            var dir = 'snapshots-book';
            try {
                fs.mkdirSync(dir);
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

                    var _$exec = /^(.+)\\(.+)$/i.exec(testFilePath),
                        _$exec2 = _slicedToArray(_$exec, 3),
                        path = _$exec2[1],
                        file = _$exec2[2];

                    var _$exec3 = /^(.+)\.(test|spec)\.(js|jsx)$/i.exec(file),
                        _$exec4 = _slicedToArray(_$exec3, 2),
                        name = _$exec4[1];

                    var css = void 0;
                    try {
                        css = fs.readFileSync(path + '\\' + name + '.css', 'utf8');
                    } catch (e) {
                        css = '';
                    }

                    var snapshots = {};
                    try {
                        var snap = fs.readFileSync(path + '\\__snapshots__\\' + file + '.snap', 'utf8');
                        // eslint-disable-next-line no-new-func
                        var populate = new Function('exports', snap);
                        populate(snapshots);
                    } catch (e) {}

                    var tests = Object.keys(snapshots);
                    if (tests.length) {
                        var _content = tests.map(function (test) {
                            return '\n                        <div style="margin-top: 1.5rem; border-top: 4px dashed red;">\n                            <div style="background-color: #f38787; padding: 0.6rem;">' + test + '</div>\n\n                            ' + snapshots[test].replace(/src=".+"/g, 'src="' + _this.dumpSvg + '"').replace(/className="/g, 'class="') + '\n                        </div>\n                    ';
                        }).join('\n\n');

                        fs.writeFileSync(dir + '/' + file + '.html', _this.getHTMLPage(name, css, _content));
                        toc.push({ file: file, name: name });
                    } else {
                        try {
                            fs.unlinkSync(dir + '/' + file + '.html');
                        } catch (e) {}
                    }
                };

                for (var _iterator = results.testResults[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    _loop();
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
                var content = '\n                <h1>The book of snapshots</h1>\n\n                <h3 style="background-color: #d6cfcf; padding: 0.6rem;">Table of contents</h3>\n\n                ' + toc.map(function (t) {
                    return '<div style="font-size: 1.2rem; margin-left: 1rem;"><a href="' + t.file + '.html">' + t.name + '</a></div>\n';
                }) + '\n            ';
                fs.writeFileSync(dir + '/index.html', this.getHTMLPage('The book of snapshots', '', content));
            } else {
                fs.writeFileSync(dir + '/index.html', 'No snapshots found.');
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