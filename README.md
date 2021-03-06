#基于封装事件来控制异步流程

前几天在《JavaScript高级程序设计》里学到了自定义事件方法，觉得很多复杂的逻辑都可以根据事件模型来解耦，通过事件监听机制来很直观的画出各个功能间的依赖关系。 

昨天看书在看面向对象程序设计章节时又看到其中一个叫模块模式，于是自己心血来潮想依着require的API自己实现一个模块加载器，略复杂，其中卡在加载各个依赖关系上面卡了一会，每个require或define如果有依赖项就得先加载它们，就像查找树节点一样一层层查到最终无依赖的节点，过程中自己还是想通过事件来完成这个功能，每加载一个依赖项（一般是动态添加js文件）则往事件队列里添加方法对象，结构如:
```
var obj = {
	id: id,
	depency: depency,
	cb: cb
};
id表示模块名称，depency表示依赖列表，cb表示该模块的方法
```
这样下来，在执行方法时会一次根据depency来调用方法，看起来就是个树形结构，当然了，这需要事件方法来支撑，结果写着写着，所以今天需要实现一个顺序执行依赖的方法，结构类似于Async，如
```
Async.waterfall([function(callback) {
    callback("data");
}, function(b,callback) {
	callback();
}]);
```
所以今天的精力就是实现这个功能，之前没有了解过Async的实现原理，所以对这个API的实现只能凭着自己目前的知识，然后我还是想到了事件的方式，对于每一个方法的执行有一个done事件表示完成该方法可以接着执行下一个方法了，下一个方法执行完后调用done表示该方法以完成且done()可以给下一个方法传递参数如done("a"),函数最后要调用fail对错误事件做处理;
最终使用结果如下：
```
eventLt.stepSync(function(done) {
	done("1a", "1b");
}, function(a, b, done) {
	setTimeout(function() {
		done("step1:LeeBox Love Shorly");
	}, 1000);
	console.log(a + b);
}, function(c) {
	console.log(c);
}).fail(function(err){
	console.log(err);
});
其中后面的fail方法是必须的
```
其中`done`是执行下一个方法的回调且可以传递参数如上，当一个方法没有done时永远不会执行到下一个方法，当然我想不会有这种需求吧，最好方法理所当然不用done，但是前面的方法还是需要用done来完成功能。
当然，我还顺便实现了类似链式调用的API，如下：
```
eventLt.step(function(done) {
	console.log('a');
	done("a", "b");
}).step(function(a, b, done) {
	console.log(a + b);
	setTimeout(function() {
		done("LeeBoxShorly");
	}, 2000);
}).step(function(a, done) {
	console.log(a);
	setTimeout(function() {
		done("Sliena");
	}, 2000);
}).step(function(s) {
	console.log(s);
	console.log(eventLt._getevents());
}).fail(function(err){
	console.log(err)
});

当done传递 eventLt.error函数时会调用fail方法；
如 done(eventLt.error("PAGE NOT FOUND"));
其中后面的fail方法是必须的，无论有没有抛错
```
还是需要done来触发下一个方法，<del>但这个方法有一个特殊的地方就是在调用的尾部需要调.done()方法。</del>

此外，还有一个方法是同时监听多个事件，直到所有事件都触发后才发生回调，且不管事件触发的顺序
```
eventLt.series("a", "b", "c", "d", function(a, b, c, d) {
	console.log('series begin');
	console.log(a);
	console.log(b);
	console.log(c);
	console.log(d);
	console.log('series end');
});

eventLt.emit("d", '1');
eventLt.emit("b", '2');
eventLt.emit("a", '3');
eventLt.emit("c", '4');

其中回调函数的返回值既series的回调函数的参数的结构为事件参数返回的数组,而且最后一个参数是相应的事件名
```

##基本原理
要讲的是链式调用方法是基于第一个方法实现的，内部会调用第一个方法，第一个方法中是把所有函数当做参数传入。
我在内部实现中把所有参数（既函数）某一事件队列，事件名称使用done+index的方式来定义，这样done1下就有一系列的事件队列，然后依次执行之，方法执行的时候会监听done事件，该方法执行结束触发done事件接着执行下一方法，以此类推。

具体看代码注释，回头我还是画个流程图出来直观点，身边没有草稿纸，都是凭空想象的。

##添加eventLt.waitQ方法 6.16
```
eventLt.waitQ("t", function(done) {
	console.log('顺序执行1');
	done();
})
eventLt.waitQ("t", function(done) {
	setTimeout(function() {
		console.log('顺序执行2');
		done();
	}, 1000)
})
eventLt.waitQ("t", function(done) {
	console.log('顺序执行3');
	done();
})
eventLt.waitQ("t", function() {
	setTimeout(function() {
		console.log('顺序执行4');
	}, 1000)
})
```
方法会根据前后顺序执行方法，通过done控制流程.
<del>理论上还是能通过done传递参数的，以后在弄吧</del>

更新后 支持done传递参数了，用法和上面的类似，还添加了fail处理，前提是需要在waitQ的前面调用eventLt.failQ方法，如 eventLt.failQ("t",function(err){});
当然这不是必须的。
