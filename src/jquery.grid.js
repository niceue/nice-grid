/*! nice Grid 0.1.0
 * (c) 2012-2013 Jony Zhang <zj86@live.cn>, MIT Licensed
 * http://niceue.com/grid/
 */
;(function ($) {
    var isIE = !!window.ActiveXObject ? (document.documentMode || (window.XMLHttpRequest ? 7 : 6) ) : 0, //IE版本, //IE版本
        isFF = !!window.sidebar && (/Firefox\/\d/).test(navigator.userAgent);

    /**
     * 调用、重载或更换部分参数后重载
     * @param {optional String|Object} options 调用对应的方法|初始化或重载grid
     * @return {jqObject}
     */
    $.fn.grid = function (options) {
        var cache = $.grid.cache;
        return this.each(function () {
            var guid = $(this).attr('data-gridguid');
            if (guid && cache[guid]) { //实例过
                var self = cache[guid], keepPageIndex;
                switch (typeof options) {
                case 'string':
                    self[options](); 
                    return;
                case 'object':
                    self._mergeOptions(options);
                    if (options.columns) { //传了columns就要重建结构
                        self.headRowCount && self._empty(); //生成过需要先移除
                        self._create();
                        return;
                    }
                    break;
                default:
                    keepPageIndex = true;
                }
                self._submitHandler(null, keepPageIndex);
            } else if (options) {
                options.container = this;
                new $.grid(options);
            }
        });
    };
    
    /**
     * 核心工厂，也用于获取实例
     * @constructor
     * @param {String|HTMLElement|jqObject|Object} options 将返回元素初始化时对应的实例
     * @example
        $.grid('#data_grid')
        $.grid(elem)
        $.grid($('div.data_grid'))
        $.grid({
            container: '#data_grid',
            url: 'controner/action',
            columns: [...],
            onRender: {...}
        });
     */
    $.grid = function (options) {
        var guid, cache = $.grid.cache;
        
        //传jQuery选择器或dom对象，则返回以该元素初始化的grid实例
        if (typeof options === "string" || !!options.tagName || !!options.jquery) {
            guid = $(options).attr('data-gridguid');
            if (guid && cache[guid]) { return cache[guid];}
            return;
        }
        if (!(this instanceof $.grid)) { return new $.grid(options); }
        if (!$.isPlainObject(options)) { return; }
        
        this._mergeOptions(options);
        this.el = $(this.options.container);
        guid = this.el.attr('data-gridguid');
        if (guid !== undefined) {
            cache[guid]._submitHandler();
        } else {
            this._construct();
            options.columns && this._create();
        }
        return this;
    };

    $.grid.cache = {};
    $.grid.guid = 0;

    $.grid.prototype = {
        options: {
            container: '#data_grid',//容器Dom或jQuery选择器
            context: null,          //用于设置$.grid相关回调函数的上下文。也就是说，让回调函数内this指向这个对象（如果不设定这个参数，那么this就指向调用本次$.grid时传递的options参数）
            delayLoad: false,       //初始化后是否不加载数据
            form: null,             //表单name值，或表单对象
            bindForm: true,         //是否绑定表单的提交事件, 默认帮助绑定了form的submit事件，但如果你需要自己来处理的话，请把此项关掉
            bindField: '',          //需要绑定的字段名，绑定后tr上面会保存属性：data-field-xxx="abc"
            url: '',                //数据请求url
            method: 'POST',         //数据请求方式
            params: {},             //数据请求参数，默认为自动收集的表单参数，如果参数与表单字段同名将覆盖表单字段，否则就新加一个提交字段
            dataType: 'json',       //数据返回类型
            dataRoot: 'rows',       //数据源的键名
            recordKey: 'recordCount', //总记录数的键名
            columns: [],            //必选，包含的列
            summary: null,          //表格汇总
            showRowIndex: false,    //是否显示行索引
            //toggleCols: null,       //控制显示与隐藏列
            colMinWidth: 35,        //列的最小宽度，决定可以拖动的最小极限
            colDefaultWidth: 120,   //列的默认宽度，决定不设置列宽时的默认宽度
            minRows: 3,             //最少多少行高度
            maxRows: null,          //最多多少行高度
            onRender: {},           //包含若干回调函数的对象，在渲染一个cell的时候执行
            title: '',              //表格标题
            height: null,           //表格内容高度，默认为自适应
            fitWindow: true,        //自适应窗口
            heightFix: 20,          //设置了fitWindow后有效，默认值10表示在自适应的时候会保持距离可视区域底部10px，如果容器的外层设置了paddingBottom或marginBottom，此值需要再加上额外的值
            checkbox: false,        //是否支持复选框, 如果值为'single'则启用单选模式,
            checked: true,          //如果数据行中有checked字段，那么按这个字段的值来决定是否在渲染的时候就选中
            selectable: true,       //是否可以选择行
            resizeable: true,       //是否可以拖拽列宽
            remoteSort: true,       //远程排序
            sortName: '',           //排序字段
            sortOrder: 'asc',       //排序方式，'asc'升序，'desc'降序
            showFooter: true,       //显示脚部
            //pageSizeOptions: [10,15,,20,25,30],  //可选择设定的每页结果数
            pageSize: 10,           //每页数据量
            pageIndex: 1            //当前页码
        },
        _construct: function () {
            this.guid = $.grid.guid++;
            this.el.attr('data-gridguid', this.guid);
            //构造新的对象之前删除页面上不存在的
            var ids = {};
            $('div[data-gridguid]').each(function(){
                ids[this.getAttribute('data-gridguid')] = 1;
            });
            $.each($.grid.cache, function (i, c) {
                if (!ids[i]) delete $.grid.cache[i];
            });
            $.grid.cache[this.guid] = this;
        },
        _mergeOptions: function (options) {
            this.options = $.extend({}, this.options, options);
            if (options.form) {
                this.form = (typeof options.form === 'string') ? document.forms[options.form] : options.form;
                if (this.options.bindForm && this.form && !$(this.form).attr('data-gridbind')) { //防止重复绑定
                    $(this.form).attr('data-gridbind', 1).on('submit.grid', $.proxy(this, '_submitHandler'));
                }
            }
        },
        //生成结构
        _create: function () {
            var html = [],
                self = this,
                opt = self.options,
                columns = opt.columns,
                headCols = self._getHeadCols(columns),  //取得表头列，并且设置headRowCount
                dataCols = self._getDataCols(columns),  //取得数据列
                headRowCount = self.headRowCount || 1;  //表头行数
            opt.context = opt.context || opt; //纠正回调的上下文
            self._getColWidth(dataCols); //保存各列宽度值
            self.extraCol = 0;
            if (opt.checkbox) {
                self.extraCol++;
                var check = { field: 'checkbox', title: opt.checkbox === 'single' ? '' : '<input type="checkbox" class="checkAll" title="全选/全不选">' };
                (headRowCount === 1) ? headCols.unshift(check) : headCols[0].unshift(check);
                dataCols.unshift(check);
                self.colWidth.unshift(35);
                if (!opt.onRender.checkbox) {
                    opt.onRender.checkbox = function (row, val, i) {
                        var checked = opt.checked ? (row.Checked ? ' checked':'') : '';
                        return '<input type="checkbox" class="grid-checkbox" index=' + i + checked +'>';
                    };
                }
            }
            if (opt.showRowIndex || (opt.summary && self.extraCol === 0)) {
                self.extraCol++;
                var rowIndex = { field: 'rowIndex', title: '' };
                (headRowCount === 1) ? headCols.unshift(rowIndex) : headCols[0].unshift(rowIndex);
                dataCols.unshift(rowIndex);
                self.colWidth.unshift(26);
                opt.onRender.rowIndex = function (row, val, i) {
                    return i + 1;
                };
            }
            if (opt.summary && self.extraCol === 1) { //汇总的时候第一列宽度不能太小
                self.colWidth[0] = opt.colMinWidth;
            }
            self.dataCols = dataCols; //保存数据列
            self.fields = self._getFields(); //保存字段
            
            html.push('<div class="grid-loading" style="display:none"></div>');
            html.push('<table class="grid-wrap" width=100% cellpadding=0 cellspacing=0 border=0 style="position:relative;table-layout:fixed;_width:auto">'); //外层包一个table时为了修复IE6的滚动条问题
            
            //第一部分：表格标题
            opt.title && html.push('<tr><td style="padding:0"><div class="grid-title">', opt.title, '</div></td></tr>');
            
            //第二部分：表格内容
            html.push('<tr><td style="padding:0"><div class="grid-table">');
            //拖拽
            opt.resizeable && html.push(self._setSizer());
            html.push('<table width=100% cellpadding=0 cellspacing=0 border=0><tr><td style="padding:0">'); //内层包一个table是为了横向内容撑开
            //表头
            html.push('<table cellpadding=0 cellspacing=0 border=0 class="grid-head">');
            var extraRow = self._setExtraRow(dataCols);
            html.push(extraRow);
            html.push(self._setHead(headCols, headRowCount));
            html.push('</table>');
            //表体
            html.push('<div class="grid-body"', (self.gridBodyHeight? ' style="height:'+self.gridBodyHeight+'px"' : ''), '><table cellpadding=0 cellspacing=0 border=0 class="grid-data"><thead>');
            html.push(extraRow);
            html.push('</thead><tbody class="gird-data-container">');
            html.push('<tr class="last-row"><td colspan="', dataCols.length, '">请输入查询条件查询</td><td class="fixed-td"></td><td class="last-td"></td></tr>');
            html.push('</tbody></table></div>');
            
            html.push('</td></tr></table>'); //内层包一个table是为了横向内容撑开
            html.push('</div></td></tr>');
            
            if (opt.showFooter) {
                //第三部分：表格脚部
                html.push('<tr><td><div class="grid-foot">');
                //分页
                html.push('<div class="grid-pager"><a href="#" rel="start" class="grid-pagenav disabled">首页</a><a href="#" rel="prev" class="grid-pagenav disabled">上一页</a>');
                html.push('<span style="margin-left:6px;margin-right:9px;" title="输入数字按Enter键切换页码"> 转到 <input type="text" class="grid-pagenav" value="1"> /<span class="page-count">0</span>页</span>');
                html.push('<a href="#" rel="next" class="grid-pagenav disabled">下一页</a><a href="#" rel="end" class="grid-pagenav disabled">尾页</a></div>');
                //统计
                html.push('<div class="grid-counter">第<span>1</span>页, <span>0</span>条记录 / 共<span>0</span>条记录</div>');
                html.push('</div></td></tr>');
            }
            
            html.push('</table>'); //外层包一个table时为了修复IE6的滚动条问题
            self.el.html(html.join(''));
            self._init();
        },

        //初始化
        _init: function () {
            var self = this, opt = self.options;
            self.gridLoading = self.el.find('div.grid-loading')[0];
            self.gridTitle = self.el.find('div.grid-title');
            self.gridHead = self.el.find('table.grid-head');
            self.gridData = self.el.find('table.grid-data');
            self.gridBody = self.el.find('div.grid-body');
            self.gridTable = self.el.find('div.grid-table');
            self.dataContainer = self.gridData.find('tbody.gird-data-container'); //数据容器
            self.bindFields = (opt.bindField && typeof opt.bindField === 'string') ? opt.bindField.split(' ') : [],
            self.records = 0;
            self.pageCount = 0;
            self.ajaxComplete = true;
            
            if (!opt.showFooter) opt.pageSize = 10000;
            //计算真实高度
            if (opt.height) opt.fitWindow = false; //设置了高度，则fitWindow一定为false
            self.needHeight = opt.fitWindow || (opt.height && opt.height !== 'auto'); //是否需要设置高度（自适应窗口、固定高度）
            if (typeof opt.height === 'string' && opt.height.substring(opt.height.length-4) === 'rows') {
                opt.minRows = +opt.height.substring(0, opt.height.length-4);
            }
            var lineHeight = self.dataContainer.find('tr:eq(0)').height();
            self.minDataHeight = opt.minRows * lineHeight;
            if (opt.maxRows) self.maxDataHeight = opt.maxRows * lineHeight;

            self.guid === 0 && $(window).on('resize.grid', function () { //不管多少个实例，window.resize事件只在第一次绑定
                if (opt.fitWindow) {
                    $.each($.grid.cache, function (i, c) {
                        c.gridTable && c._adjustSize();
                    });
                }
            });

            self.el.on('complete.grid', $.proxy(self, '_onComplete'));
            self.el.on('click.grid', 'a.grid-pagenav', $.proxy(self, '_changePage')).on('keyup.grid', 'input.grid-pagenav', $.proxy(self, '_changePage')); //分页
            self.el.on('focusout.grid', 'input.grid-pagenav', function(){
                var index = +this.value || opt.pageIndex;
                if (opt.pageIndex !== index) {
                    opt.pageIndex = index;
                    self.queryData();
                } else {
                    this.value = index;
                }
            });
            if (isIE === 6) {
                self.gridData.on('mouseenter mouseleave', 'tr', function (e) { //IE6不支持tr:hover
                    if (e.type === 'mouseenter') {
                        $(this).addClass('hover');
                    } else {
                        $(this).removeClass('hover');
                    }
                });
            }
            if (opt.checkbox) { //复选框
                opt.selectable = false;
                self.el.on('click.grid', 'input.checkAll', function (e) {
                    var check = $(this).prop('checked');
                    self.dataContainer.find(':checkbox').each(function (i) {
                        $(this).prop('checked', check);
                        var tr = $(this).closest('tr');
                        tr.removeClass('row-checked');
                        check && tr.addClass('row-checked');
                        self._setData( tr.attr('index'), 'Checked', check );
                    });
                });
                self.gridData.on('click.grid', 'tr', function (e) {
                    var _this = $(this), 
                        cls = 'row-checked',
                        isCheck;
                    if (!$(e.target).is('td,:checkbox.grid-checkbox')) return;
                    if (opt.checkbox === 'single') {
                        _this.siblings().removeClass(cls).find(':checkbox').prop('checked', false);
                        self._resetChecked();
                    }
                    isCheck = _this.toggleClass(cls).hasClass(cls);
                    _this.find(':checkbox').prop('checked', isCheck);
                    self._setData( _this.attr('index'), 'Checked', isCheck );
                });
            }
            if (opt.selectable) { //点击选中行
                self.gridData.on('click.grid', 'tr', function (e) {
                    var _this = $(this), cls = 'row-checked';
                    if ( $(e.target).is('a[fn]') ) { 
                        !_this.hasClass(cls) && _this.addClass(cls);
                    } else {
                        _this.toggleClass(cls);
                    }
                    !e.ctrlKey && _this.siblings().removeClass(cls);
                });
            }
            isFF && self.gridData.on('mousedown.grid', 'tr', function (e) { e.ctrlKey && e.preventDefault(); }); //火狐下ctrl+点击，当前的td会出现蓝色框框，要阻止掉
            //排序
            self.el.on('click.grid', 'span.sortable', function (e) {
                var _this = $(this), order = _this.attr('order') || opt.sortOrder;
                opt.sortName = _this.closest('td').attr('field');
                opt.sortOrder = order;
                _this.attr('order', order == 'asc' ? 'desc' : 'asc').removeClass('up dn').addClass(order === 'asc' ? 'up' : 'dn');
                self._submitHandler();
            });

            if (opt.resizeable) { //拖拽
                self.gridSizer = self.gridTable.find('div.drag-handler');
                self._dragInit();
            }
            self.gridData.on('click.grid', 'a[fn]', function (e) { //点击行事件
                if (opt.checkbox && opt.checkbox !== 'single') e.stopPropagation();
                e.preventDefault();
                var a = $(this), fn = a.attr('fn'), rows = self.data, index = a.closest('tr')[0].rowIndex - 1;
                opt.context[fn].apply(opt.context, [e, rows[index]]);
            });

            self._adjustSize();
            
            if (opt.delayLoad){
                self._onComplete(); //如果默认不加载数据，onComplete方法要提前执行
            } else {
                self._submitHandler();
            }
            
            self.el.trigger('created.grid');
        },

        //提交查询
        _submitHandler: function (e, keepPageIndex) {
            e && e.preventDefault();
            if (!this.ajaxComplete) { return; } //数据请求回来后才能继续提交
            var params = {}, opt = this.options;
            if (this.form) { //存在表单要收集表单数据
                var paramsArray = $(this.form).serializeArray();
                $.each(paramsArray, function (i, n) {
                    if (!(n.name in params)) { //未建立项
                        params[n.name] = n.value;
                    } else {
                        params[n.name] += ',' + n.value; //为了把数组值转为字符串值
                    }
                });
            }
            if (!keepPageIndex) opt.pageIndex = 1;
            this.postData = $.extend(params, opt.params);
            this.queryData('form');
        },

        //请求数据
        queryData: function (isForm) {
            var self = this,
                opt = self.options,
                data = {};
            if (opt.data) { //如果是模拟数据
                self._onGetData(opt.data, true);
            } else if (!isForm && self.frontPaging) {
                data[opt.dataRoot] = self.data;
                self._onGetData(data, true);
            } else if (opt.url) {
                self.gridLoading.style.display = '';
                self.postData = $.extend({}, self.postData, {
                    pageIndex: opt.pageIndex,
                    pageSize: opt.pageSize,
                    sortName: opt.sortName,
                    sortOrder: opt.sortOrder
                });
                self.ajaxComplete = false;
                $.ajax({
                    context: self,
                    cache: false,
                    url: opt.url,
                    type: opt.method,
                    dataType: opt.dataType,
                    data: self.postData,
                    complete: function () {
                        self.ajaxComplete = true;
                        self.gridLoading.style.display = 'none';
                    },
                    success: function (d) {
                        if ( !(opt.recordKey in d) ) {
                            self.frontPaging = true;
                        }
                        self._onGetData(d);
                    }
                });
            } else { //data 和 url 都不传， 那你想干什么
                data[opt.dataRoot] = [];
                data[opt.recordKey] = 0;
                self._onGetData(data);
            }
        },
        //得到数据
        _onGetData: function (data, paging) {
            var self = this,
                opt = self.options, 
                rows, sIndex, nIndex;
            self.el.trigger('getdata', [data]);
            self.data = data[opt.dataRoot];
            if (paging || self.frontPaging) { //前端自动根据pageSize分页
                sIndex = (opt.pageIndex - 1) * opt.pageSize;
                nIndex = sIndex + opt.pageSize;
                self.records = self.data.length;
                rows = self.data.slice(sIndex, nIndex);
            } else {
                self.records = data[opt.recordKey];
                rows = self.data;
            }
            self.pageRowCount = rows.length;
            self.pageCount = Math.ceil(self.records / opt.pageSize);
            self.renderData(rows);
        },
        //发生异常（暂不需要）
        _onError: function (msg) {
            this.data = msg;
            this.renderData();
        },

        //渲染数据
        renderData: function (data) {
            var self = this,
                opt = self.options,
                html = [],
                data = data || self.data || [],
                msg = typeof data === 'string' ? data : '',
                onRender = opt.onRender;
            if (msg || !data.length) {
                html.push('<tr class="last-row"><td colspan="', self.dataCols.length, '">', (msg || '暂无数据!'), '</td><td class="last-td"></td></tr>');
            } else {
                var i = 0, j, dlen = data.length, 
                    dataCols = self.dataCols, clen = dataCols.length, 
                    row, col, field, 
                    bindFields = self.bindFields, blen = bindFields.length,
                    isChecked = opt.checkbox && opt.checked,
                    totleRows = 0;
                for (; i < dlen; i++) {
                    j = 0;
                    row = data[i];
                    if (!isChecked) {
                        row.Checked = 0;
                    }
                    html.push('<tr', (isChecked && row.Checked ? ' class="row-checked"' : '') );
                    if (blen) {
                        var k = blen;
                        while(k--) {
                            html.push(' data-'+ bindFields[k] +'="'+ row[bindFields[k]] +'"');
                        }
                    }
                    html.push(' index="', i, '">');
                    for (; j < clen; ) {
                        col = dataCols[j++];
                        field = col.field;
                        html.push('<td', (col.align ?  ' align=' + col.align : ''), '>');
                        html.push(onRender[field] ? onRender[field].apply(self, [row, row[field], i]) : row[field], '</td>');
                    }
                    html.push('<td class="last-td"></td></tr>');
                }
                totleRows = dlen;
                if (opt.summary) { //汇总行
                    var summaryData = self._getSummaryData(),
                        extraCol = self.extraCol, summaryColspan = (extraCol > 1) ? ' colspan=' + extraCol : '';
                    $.each(summaryData, function (i, row) {
                        var j = extraCol;
                        html.push('<tr class="grid-summary">');
                        html.push('<td', summaryColspan, '>', row.summaryTitle, '</td>');
                        for (; j < clen; ) {
                            col = dataCols[j++];
                            field = col.field;
                            html.push('<td', (col.align ?  ' align=' + col.align : ''), '>');
                            html.push(row[field], '</td>');
                        }
                        html.push('<td class="last-td"></td></tr>');
                    });
                    totleRows += summaryData.length;
                }
                if (opt.maxRows) {
                    self.needHeight = (totleRows > opt.maxRows) ? true : false;
                }
                
            }
            self.dataContainer.html(html.join(''));
            if (opt.checkbox) {
                self.gridHead.find('input.checkAll').prop('checked', false);
            }
            self.isHide && self.show();
            self.el.trigger('complete.grid'); //触发渲染完成事件
        },

        //渲染完成
        _onComplete: function (e) {
            this.gridSizer && this.gridSizer.children().height(this.gridTable.height()); //以下2行解决：IE6绝对定位的元素高度必须给个具体的值
            this.gridLoading.style.height = this.el.height() - 10 + 'px';
            this.dataContainer.find('tr:last').addClass('last-row');
            if (this.options.showFooter) {
                this._updatePager();
            }
            this.options.fitWindow === 'need' && this._adjustSize();
        },

        //调整尺寸
        _adjustSize: function () {
            var self = this;
            if (self.timeout) return;
            self.timeout = setTimeout(function () {
                if (isIE && isIE < 8) { //IE6/7滚动条会挡住最后一行内容
                    var _this = self.gridTable[0];
                    _this.style.paddingBottom = self._isHScroll(_this) ? '17px' : '0';
                }
                self.needHeight && self._fitHeight();
                self.timeout = null;
            }, 50);
        },
        //适应高度
        _fitHeight: function(){
            var self = this,
                opt = self.options,
                h, 
                oh = opt.height^0, 
                th = self.gridTitle.height() || 0,
                ft = opt.showFooter ? 31 : 0,
                minH = self.minDataHeight, //至少三行高度
                maxH = self.maxDataHeight,
                fix = self.gridHead.height() + th + ft + 2 + (self._isHScroll(self.gridTable[0]) ? 17 : 0); //头部和底部高度，并且加上边框和滚动条影响
            if (opt.fitWindow) oh = $(window).height() - self.el.offset().top - opt.heightFix; //未设置高度认为是适应窗口
            h = oh - fix;
            if (h < minH) h = minH;
            if (maxH && h > maxH) h = maxH;
            self.gridBody.height(h);
            self.gridBodyHeight = h;
        },
        _isHScroll: function (el) {
            return el.scrollWidth - el.clientWidth !== 0;
        },
        
        //取得表头列
        _getHeadCols: function (columns) {
            var self = this, 
                rows = [],
                getColspan = function (cols) {
                    var arr = [];
                    self._mapTree(cols, arr);
                    return arr.length;
                },
                callSelf = function (cols, key, isFirst) {
                    var i = 0, len = cols.length, col;
                    !isFirst && key++;
                    rows[key] = rows[key] || [];
                    for (; i < len; ) {
                        col = cols[i++];
                        rows[key].push(col);
                        if ('columns' in col) { //要计算colspan但不用计算rowspan
                            col.rowspan = 1;
                            col.colspan = getColspan(col.columns);
                            callSelf(col.columns, key);
                        }
                    }
                };
            callSelf(columns, 0, true);
            self.headRowCount = rows.length; //保存表头的行数
            return (rows.length === 1) ? rows[0] : rows;
        },
        //取得数据列
        _getDataCols: function (columns) {
            if (this.headRowCount === 1) return columns;
            var cols = [];
            this._mapTree(columns, cols);
            return cols;
        },
        //取得列宽及最小列宽
        _getColWidth: function (cols) {
            var colWidth = [], minWidth = [], cmWidth,
                i = 0, len = cols.length, col,
                colMinWidth = this.options.colMinWidth,
                colDefaultWidth = this.options.colDefaultWidth;
            for (; i < len; ) {
                col = cols[i++];
                cmWidth = col.minWidth || colMinWidth;
                minWidth.push(cmWidth);
                colWidth.push(col.width ? Math.max(col.width, cmWidth) : colDefaultWidth);
            }
            this.minWidth = minWidth;
            this.colWidth = colWidth;
        },
        //平面化树
        _mapTree: function (arr, map) {
            var i = 0, len = arr.length, col;
            for (; i < len; ) {
                col = arr[i++];
                ('columns' in col) ? this._mapTree(col.columns, map) : map.push(col);
            }
        },
        //设置额外的行
        _setExtraRow: function (cols) {
            var html = [], i = 0, len = cols.length, colWidth = this.colWidth;
            html.push('<tr class="first-row">');
            for (; i < len; ) {
                html.push('<td style="width:', colWidth[i++], 'px"></td>');
            }
            html.push('<td class="fixed-td"></td><td></td></tr>');
            return html.join('');
        },

        //设置表头HTML，支持多级合并单元格
        _setHead: function (headCols, headRowCount) {
            var html = [], count = headRowCount, i = 0, len = headCols.length,
                col, row, colspan, rowspan, align, field, cls1, cls2;
            if (count === 1) {
                html.push('<tr>');
                for (; i < len; ) {
                    col = headCols[i++];
                    align = col.align ?  ' align=' + col.align : '';
                    field = col.field ? ' field=' + col.field : '';
                    cls2 = (col.sortable && col.field) ? ' class="sortable"' : '';
                    html.push('<td', field, align, '><span', cls2, '>', col.title, '</span>', '</td>');
                }
                html.push('<td class="fixed-td"></td><td class="last-td"></td></tr>');
            } else { //多行表头
                for (; i < len; i++) {
                    row = headCols[i];
                    html.push('<tr>');
                    for (var j = 0, rlen = row.length; j < rlen; j++) {
                        col = row[j];
                        colspan = col.colspan;
                        colspan = (colspan && colspan > 1) ? ' colspan=' + colspan : '';
                        rowspan = col.rowspan || count;
                        rowspan = (rowspan > 1) ? ' rowspan=' + rowspan : '';
                        align = col.align ?  ' align=' + col.align : '';
                        field = col.field ? ' field=' + col.field : '';
                        cls1 = colspan ? ' class="colspan"' : '';
                        cls2 = (col.sortable && col.field) ? ' class="sortable"' : '';
                        html.push('<td', cls1, field, colspan, rowspan, align, '><span', cls2, '>', col.title, '</span>', '</td>');
                    }
                    (i === 0) && html.push('<td class="fixed-td" rowspan="', count, '"></td><td class="last-td" rowspan="', count, '"></td>');
                    html.push('</tr>');
                    count--;
                }
            }
            return html.join('');
        },

        //取得所有字段
        _getFields: function () {
            var fields = [];
            $.each(this.dataCols, function (key, obj) {
                fields.push(obj.field);
            });
            fields.splice(0, this.extraCol);
            return fields;
        },
        //取得小数位数
        _getDecimal: function (num) {
            var str = num.toString(), len = str.lastIndexOf('.');
            return (len !== -1) ? (str.length - len - 1) : 0;
        },
        //格式化浮点数
        _formatFloat: function (num, length) {
            var n = Math.pow(10, length);
            return (num * n / n).toFixed(length);
        },
        //获取汇总参数
        _getSummary: function () {
            var clen = this.dataCols.length,
                summary = $.extend({}, this.options.summary),
                need = Array(clen);
            $.each(summary, function (key, val) {
                var arr = Array(clen);
                for (var i = 0; i < val.length; i++) {
                    arr[val[i]] = 1;
                    need[val[i]] = 1;
                }
                summary[key] = arr;
            });
            summary.need = need;
            return summary;
        },
        //计算汇总数据
        _getSummaryData: function () {
            var sum, avg, value, rows = [], decimal,
                data = this.data, dlen = data.length,
                field, fields = this.fields, flen = fields.length,
                summary = this._getSummary(),
                isSum = summary.sum, isAvg = summary.avg,
                avgObj = { summaryTitle: '平均' }, sumObj = { summaryTitle: '合计' };
            for (var i = 0; i < flen; i++) {
                field = fields[i];
                sum = 0;
                avg = 0;
                if (summary.need[i]) { //如果有汇总
                    decimal = this._getDecimal(data[0][field] || "");
                    for (var j = 0; j < dlen; j++) {
                        value = parseFloat(data[j][field]);
                        if (!value) continue;
                        sum += value;
                    }
                    avg = sum * 1.0 / dlen;
                    avgObj[field] = (isAvg && isAvg[i]) ? this._formatFloat(avg, decimal) : '';
                    sumObj[field] = (isSum && isSum[i]) ? this._formatFloat(sum, decimal) : '';
                } else {
                    avgObj[field] = '';
                    sumObj[field] = '';
                }
            }
            isAvg && rows.push(avgObj);
            isSum && rows.push(sumObj);
            return rows;
        },
        
        //更新分页
        _updatePager: function () {
            var pageCount = this.pageCount,
                pageIndex = this.options.pageIndex,
                pager = this.el.find('div.grid-foot').children(),
                a = pager.find('a'),
                input = pager.find('input');
            if (input.length) {
                pager.find('span.page-count').text(pageCount);
                if (pageCount <= 1) {
                    input.prop('disabled', true);
                    a.removeClass('disabled').addClass('disabled').siblings('span').removeClass('disabled').addClass('disabled');
                } else {
                    input[0].value = pageIndex;
                    input.prop('disabled', false);
                    if (pageIndex === 1) a.slice(0, 2).addClass('disabled').end().slice(-2).removeClass('disabled');
                    else if (pageIndex === pageCount) a.slice(-2).addClass('disabled').end().slice(0, 2).removeClass('disabled');
                    else a.removeClass('disabled');
                    a.siblings('span').removeClass('disabled');
                }
                pager.eq(1).find('span').eq(0).text(pageIndex).end()
                                        .eq(1).text(this.pageRowCount || 0).end()
                                        .eq(2).text(this.records).end();
            }
        },
        //切换页
        _changePage: function (e) {
            e.preventDefault();
            var _this = $(e.target), pageIndex = this.options.pageIndex, pageCount = this.pageCount, index, code;
            if (_this.hasClass('disabled')) return;
            if (e.type === 'keyup') {
                code = e.keyCode;
                if (code === 13) {
                    index = +_this.val() || 1;
                    if ( pageIndex === index ) return;
                } else {
                    e.target.value = e.target.value.replace(/[^\d]/g, '');
                    if ( e.target.value > pageCount ) e.target.value = pageCount;
                }
            } else {
                switch (_this.attr('rel')) {
                    case 'start': index = 1; break;
                    case 'prev': index = pageIndex - 1; break;
                    case 'next': index = pageIndex + 1; break;
                    case 'end': index = pageCount;
                }
            }
            if (!index) return;
            this.options.pageIndex = index;
            this.queryData();
        },

        _setSizer: function () {
            var html = [], i = 0, len = this.dataCols.length;
            html.push('<div class="drag-handler">');
            for (; i < len; ) {
                html.push('<span class="drag-line" index="', i++, '"></span>');
            }
            html.push('</div>');
            return html.join('');
        },

        _dragInit: function () {
            var self = this, obj, index, startLeft, startX, moveX = 0, currentWidth, opt = self.options, minWidth = opt.colMinWidth,
                cells1 = self.gridHead[0].rows[0].cells,
                cells2 = self.gridData[0].rows[0].cells,
                gridTable = self.gridTable,
                sizer = self.gridSizer.children(),
                start = function (e) {
                    obj = e.currentTarget;
                    $(obj).addClass('moving');
                    index = parseInt($(obj).attr('index'), 10);
                    currentWidth = parseInt(cells1[index].style.width, 10);
                    minWidth = self.minWidth[index];
                    startLeft = parseInt(obj.style.left, 10);
                    startX = e.clientX;
                    $(document).on({ 'mousemove.grid': move, 'mouseup.grid': end });
                    gridTable.addClass('drag-panel');
                    return false;
                },
                move = function (e) {
                    moveX = e.clientX - startX;
                    if (currentWidth + moveX <= minWidth) moveX = minWidth - currentWidth; //不能小于最小宽度值
                    obj.style.left = (startLeft + moveX) + 'px';
                    return false;
                },
                updateSizer = function () {
                    var _this, i = index + 1, len = cells1.length - 2,
                        c1 = cells1[index].style, c2 = cells2[index].style,
                        w1 = parseInt(c1.width, 10), w2 = parseInt(c2.width, 10);
                    if (moveX !== 0) {
                        c1.width = w1 + moveX + 'px';
                        c2.width = w2 + moveX + 'px';
                        for (; i < len; ) {
                            _this = sizer.eq(i++)[0].style;
                            _this.left = (parseInt(_this.left, 10) + moveX) + 'px';
                        }
                        moveX = 0;
                        self._adjustSize(); //拖拽后可能会产生滚动条
                    }
                },
                end = function (e) {
                    $(document).off({ 'mousemove.grid': move, 'mouseup.grid': end });
                    updateSizer();
                    gridTable.removeClass('drag-panel');
                    $(obj).removeClass('moving');
                };
            sizer.each(function (i) {
                this.style.left = (self.colWidth[i] + $(cells1[i]).position().left) + 'px';
            });
            if (opt.checkbox || opt.showRowIndex) sizer.eq(0)[0].style.display = 'none';
            if (opt.checkbox && opt.showRowIndex) sizer.eq(1)[0].style.display = 'none';
            self.el.on('mousedown.grid', 'span.drag-line', start);
        },

        //移除grid，用于重新生成
        _empty: function () {
            this.gridData && this.gridData.off();
            this.el.off('.grid');
            this.el[0].innerHTML = '';
        },
        
        _setData: function(index, key, value){
            var self = this,
                opt = self.options,
                row;
            if (self.frontPaging) { //如果是前端分页，index需要处理
                index = opt.pageSize * (opt.pageIndex - 1) + (+index);
            }
            row = self.data[index];
            if (row) row[key] = value;
        },
        
        _getChecked: function(){
            return this.dataContainer.find('tr.row-checked');
        },
        
        _resetChecked: function(){
            $.each(this.data, function(i, obj){
                obj.Checked = 0;
            });
        },
        
        _getCheckedRows: function(field){
            var ret = [], 
                rows = this.data;
            $.each(rows, function(i, obj){
                if (obj.Checked) {
                    ret.push(obj);
                }
            });
            return ret;
        },
        
        /**
         * 获取指定字段的所有值
         * @param {String} 字段名
         * @return {Array} 指定字段的所有值
         */
        getDataByField: function(fieldName){
            var data = [];
            $.each(this.data, function(i, obj){
                data[i] = obj[fieldName];
            });
            return data;
        },
        
        /**
         * 返回选中行的数据
         * @return {Array} 选中行的数据
         */
        getCheckedRows: function () {
            return this._getCheckedRows();
        },
        
        /**
         * 返回选中行指定字段的数据
         * @return {Array} 选中行指定字段的数据
         */
        getCheckedData: function (field) {
            return this._getCheckedRows(field);
        },

        /**
         * 移除选中行，包括数据
         * @return {Array} 移除成功的列表
         */
        removeCheckedRows: function(){
            var data = [];
            $.each(this.data, function(i, obj){
                if (!obj.Checked) {
                    data.push(obj);
                }
            });
            this._onGetData({recordCount:data.length, rows:data});
            return data;
        },
        
        _getValidData: function(row, fields){
            var i = fields.length,
                ret = '';
            if (!i) return;
            while (i--) {
                ret += row[fields[i]];
            }
            return ret;
        },
        
        _getAllValidData: function(){
            var self = this,
                fields = self.bindFields,
                arr = [];
            if (!fields.length) return;
            $.each(self.data, function(i, obj){
                arr.push( self._getValidData(obj, fields) );
            });
            return arr;
        },
        
        /**
         * 添加行数据
         * @param {Array}  要添加到grid列表中的数据
         * @return {Array} 添加失败的列表
         */
        addRows: function(rows){
            if (!$.isArray(rows)) return;
            var self = this,
                data,
                arr = [],
                fields = self.bindFields,
                allValidData;
            if (!fields.length) return;
            allValidData = this._getAllValidData();
            $.each(rows, function(i, obj){
                var value = self._getValidData(obj, fields);
                if ( $.inArray(value, allValidData) === -1 ) {
                    obj.Checked = 0;
                    arr.push(obj);
                }
            });
            data = this.data.concat(arr);
            this._onGetData({recordCount:data.length, rows:data});
        },
        
        /**
         * 编辑行数据
         * @param {Number} 行号
         * @param {Number} 要修改的字段
         */
        editRow: function(index, row){
            if (index === undefined || !$.isPlainObject(row)) return false;
            var data = this.data[index];
            $.each(row, function(key, val){
                data[key] = val;
            });
        },

        /**
         * 隐藏grid
         */
        hide: function(){
            var wrap = this.el.children('table');
            wrap.length && (wrap[0].style.display = 'none');
            this.isHide = true;
        },

        /**
         * 显示grid
         */
        show: function(){
            var wrap = this.el.children('table');
            wrap.length && (wrap[0].style.display = '');
            this.isHide = false;
            this._adjustSize(); //由于隐藏的时候高度不能被正确计算
        },

        /**
         * 完全销毁干净
         */
        destroy: function () {
            this._empty();
            this.form && $(this.form).off('submit.grid').removeAttr('data-gridbind');
            this.el.removeAttr('data-gridguid');
            delete $.grid.cache[this.guid];
        }
    };
})(jQuery);

/**
 * TODO:
 * 支持分组(groupby: {field: 'xxx', title:'城市'})
 * 支持明细(onShowDetail: function(row){})
 * 绑定事件(bindRowEvent: {dblclick: function(e, row){...}, contextmenu: function(e, row){...}, ...})
 * 支持隐藏列(columns[i].hidden / showColSwitch: true)
 */