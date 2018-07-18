# jest-snapshots-book
Custom jest reporter that builds html representations of snapshots. 

Each time when jest is run this reporter will produce a convenient book of snapshots with table of contents. The book will be placed in the folder "snapshots-book" in the root of your project. 

You can check up your snapshots in the browser instead of manually listing them in a code editor. For React components all styles (including those from css-modules) will be applied, so that you can see styled components in your browser.

Here is an example of snapshots for paginator React component.

#Usage
Install as a dev dependency
```
$ npm install --save-dev jest-snapshots-book
```
Add after default jest reporters in jest configuration
```
    "reporters": [
      "default",
      "jest-snapshots-book"
    ]

```


    "modulePathIgnorePatterns": [
        "<rootDir>/snapshots-book"
    ],
    "watchPathIgnorePatterns": [
        "<rootDir>/snapshots-book"
    ],

     "reporters": [
      "default",
      ["jest-snapshots-book", {"verbose": true}]
    ]
   