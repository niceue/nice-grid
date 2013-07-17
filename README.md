## Grid
A data table jQuery plugin.


### Usage
Include resources:
``` html
<link rel="stylesheet" href="path/to/jquery.grid.css">
<script type="text/javascript" src="path/to/jquery.grid.js"></script>
```

Initialization：
``` html
<div id="data_grid"></div>
```
``` js
$('#data_grid').grid({
    url: 'controner/action',
    columns: [
        {title: "ID", field: "table_id"},
        {title: "Name", field: "table_name"},
        {title: "Contact", field: "table_contact"},
        {title: "Operating", field: "operating"}
    ],
    onRender: {
        operating: function(row){
            return '<a href="#" fn="fEdit">Edit</a>';
        }
    },
    fEdit: function(e, row){
        e.preventDefault();
        //do something..
    }
});
```

Get an instance:
``` js
$.grid('#data_grid');
```

Refresh a grid:
``` js
$('#data_grid').grid();
```

Refresh a grid width params:
``` js
$('#data_grid').grid({
    //All support optionss
});
```


### Documention
[简体中文](http://niceue.com/grid/)

### Dependencies
[jQuery 1.7+](http://jquery.com)

### Browser Support
  * IE6+
  * Chrome
  * Safari 4+
  * Firefox 3.5+
  * Opera


### Bugs / Contributions
- [Report a bug](https://github.com/niceue/grid/issues)
- To contribute or send an idea, github message me or fork the project


### Build
Grid use [UglifyJS2](https://github.com/mishoo/UglifyJS) 
you should have installed [nodejs](nodejs.org) and run `npm install uglify-js -g`.

  
### License
[MIT License](https://github.com/niceue/grid/blob/master/LICENSE.txt).
