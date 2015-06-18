(function(global) {
	// 自定义事件
	var eventLt = function() {
		// var events = Object.create(null);
		var events = {
			queue: null
		};
		var obj = new Object();
		// 随机事件名称计数
		var ramIndex = 0;
		obj._getevents = function() {
			return events;
		};
		obj.on = function(eventname, cb, cover) {
			// 如果覆盖同名事件
			if (cover) {
				events[eventname] = {
					name: eventname,
					listener: cb
				}
			} else {
				if (events.hasOwnProperty(eventname)) {
					events[eventname].listeners.push(cb);
					events[eventname].listener = cb;
				} else {
					// listener保存着最新的回调，listeners保存所有回调
					events[eventname] = {
						name: eventname,
						listener: cb,
						listeners: [cb]
					}
				}
			}
		};
		// 只触发一次便删除
		obj.once = function(eventname, cb) {
			events[eventname] = {
				name: eventname,
				listener: cb,
				once: true
			}
		};
		// 只监听单一事件,只认可第一次添加的事件
		obj.addone = function(eventname, cb) {
			if (!events.hasOwnProperty(eventname)) {
				events[eventname] = {
					name: eventname,
					listener: cb,
					listeners: [cb]
				}
			}
		};
		// 触发事件
		obj.emit = function(eventname) {
			if (events.hasOwnProperty(eventname)) {
				var listener = events[eventname].listener;
				if (typeof listener == "function") {
					// 无论如何，触发事件传递的参数最后一个是事件名称
					var args = Array.prototype.slice.call(arguments, 1);
					args.push(eventname);
					// 如果是once或者listeners长度为0，表示该事件已经执行完毕可以删除
					if (events[eventname].once) {
						delete events[eventname];
					} else if (events[eventname].listeners.length === 0) {
						delete events[eventname];
					}
					listener.apply(this, args || []);
				}
			};
		};

		// 触发事件并删除该事件
		obj.emitAndRemove = function(eventname) {
			if (events.hasOwnProperty(eventname)) {
				var listener = events[eventname].listener;
				if (typeof listener == "function") {
					// 无论如何，触发事件传递的参数最后一个是事件名称
					var args = Array.prototype.slice.call(arguments, 1);
					args.push(eventname);
					listener.apply(this, args || []);
					// 移除监听器
					delete events[eventname];
				}
			};
		};
		// 监听一系列事件，当这一系列事件都完成触发的情况下，才会执行回调函数
		obj.series = function() {
			// 前面的参数是事件名称
			var args = Array.prototype.slice.call(arguments, 0, arguments.length - 1);
			var callback = arguments[arguments.length - 1];
			// 保存回调参数
			var cbargs = [];
			// 哨兵变量
			var count = 0;
			for (var i = 0, length = args.length; i < length; i++) {
				var idx = i;
				obj.once(args[i], function() {
					// 无论如何，触发事件传递的参数最后一个是事件名称
					var key = arguments[arguments.length - 1];
					for (var j = 0, len = args.length; j < len; j++) {
						if (key === args[j]) {
							cbargs[j] = Array.prototype.slice.call(arguments);
						}
					}
					count++;
					if (count === args.length) {
						callback.apply(this, cbargs || []);
					}
				})
			}
		};

		obj.defer = function(callbacks) {
			return {
				step: function(cb) {
					callbacks.push(cb);
					return obj.defer(callbacks);
				},
				done: function() {
					obj.stepSync.apply(this, callbacks);
				},
				fail: function(cb) {
					obj.stepSync.apply(this, callbacks).fail(cb);
				}
			}
		};
		// 顺序执行方法,接受一系列方法，
		// 而每个方法需要有一个标志位done，表示该函数已经执行完成(因为在某些异步场景无法确定它在哪一处完成)
		// 规定，但链式方法中，不存在done时表示链式方法的末尾
		// 创建一个新的defer并开始压入队列
		obj.step = function(callback) {
			// 把所有cb压入队列，然后执行stepSync方法
			var callbacks = [];
			callbacks.push(callback);
			return new obj.defer(callbacks);
		};
		// 同步执行方法,根据done标志位执行下一个方法
		obj.stepSync = function() {
			ramIndex++;
			// 定义两个随机事件名称，一个是done一个stepSync，那就是加上时间戳
			// 循环压入事件队列
			var args = Array.prototype.slice.call(arguments, 0);
			for (var i = 0, len = args.length; i < len; i++) {
				obj.on("wait" + ramIndex, args[i]);
			}
			// 依次触发done事件
			// var listners = events["stepSync"];
			var next = function(eventname) {
				if (events[eventname].listeners.length > 0) {
					// 弹出listners中的第一项到listner待触发
					events[eventname].listener = events[eventname].listeners.shift();
					var args = Array.prototype.slice.call(arguments, 0);
					// 触发方法obj.emit("stepSync",done);
					obj.emit.apply(this, args);
				}
			};
			// 完成函数回调，流程是由这个来控制的
			var done = function(index) {
				return function() {
					var args = Array.prototype.slice.call(arguments, 0);
					// 判断是否为错误对象
					if (args[0] instanceof EventError) {
						// 报之后执行fail方法，然后清除事件监听
						var err = args[0].error;
						obj.emit("wait" + index + "fail", err);
						// 清除事件监听
						delete events["wait" + index];
					} else {
						//当执行done后如何知道这个done属于哪个event
						// 解决方法是使用一个高阶函数
						args.unshift("done", index);
						obj.emit.apply(this, args);
					}
				}
			};
			// 监听done事件，返回执行结束的参数
			obj.addone("done", function() {
				var params = Array.prototype.slice.call(arguments, 1, arguments.length - 1);

				// var evtname = arguments[arguments.length - 1];
				// 获取事件名的后面的标志
				var index = Array.prototype.slice.call(arguments, 0, 1);
				params.push(done(index));
				params.unshift("wait" + index);
				next.apply(this, params);
			});
			// next所做的事就是把listeners里的函数依次弹出为listner并执行
			// 依次取出事件执行
			// next("wait" + ramIndex, done(ramIndex));
			return obj.result("wait" + ramIndex, function() {
				next("wait" + ramIndex, done(ramIndex));
			});
		};

		// 错误对象
		obj.error = function(err) {
			return new EventError(err);
		};

		function EventError(err) {
			this.error = err;
		}
		// 当队列执行失败后执行这个方法
		obj.result = function(evtname, begin) {
			// 保存到事件属性
			// 当触发错误信息是会执行之
			return {
				fail: function(cb) {
					obj.once(evtname + "fail", function() {
						//最后一个是事件名去除掉
						var args = Array.prototype.slice.call(arguments, 0, arguments.length - 1);
						cb.apply(this, args);
					});
					begin();
				}
			}

		};

		// 等待队列，参数为监听的事件和回调，接受多个事件压入事件队列
		// 自动执行顺序执行，没有关系依赖
		obj.waitQ = function(eventname, cb) {
			var done = function() {
				// 如果有返回值则需要把值保存到param中
				var args = Array.prototype.slice.call(arguments, 0);
				// 检查是否有返回错误
				if (args[0] instanceof EventError) {
					var err = args[0].error;
					obj.emit(eventname + "fail", err);
					events[eventname].fail = true;
					events[eventname].queue.splice(1, events[eventname].queue.length - 1);
				} else {
					events[eventname].param = args;
					// 检查queue队列是否有值，有则弹出到listener
					if (events[eventname] && events[eventname].queue.length > 1) {
						events[eventname].queue.shift();
						events[eventname].listener = events[eventname].queue[0];
						obj.emitQ(eventname);
					} else {
						events[eventname].runnable = true;
					}
				}
			};
			// 包装cb，cb是先进先出队列，所有listener第一个是第一次进入的方法
			// 执行结束后再弹出头部函数
			var cbWrap = function(callback) {
				return function() {
					// 执行这个方法的时候检查param中是否包含有参数，有则添加进来
					var evtname = arguments[arguments.length - 1];
					// 这里形成的引用，最args的任何修改都会影响param，所以需要深拷贝
					var args = events[evtname].param.concat();
					// 传入done回调，用这个追踪下一个监听行为
					args.push(done);
					callback.apply(this, args);
				}
			}
			if (events.hasOwnProperty(eventname)) {
				if (!events[eventname].fail) {
					events[eventname].queue.push(cbWrap(cb));
					if (events[eventname].runnable) {
						events[eventname].queue.shift();
						events[eventname].listener = events[eventname].queue[0];
						obj.emitQ(eventname);
					}
				}
			} else {
				events[eventname] = {
					name: eventname,
					listener: cbWrap(cb),
					queue: [cbWrap(cb)],
					// 保存上一次执行完的参数
					param: [],
					runnable: true,
					fail: false
				};
				// 如果是第一次进入队列则开始执行，之后自动执行
				obj.emitQ(eventname, true);
			}
		};
		obj.failQ = function(eventname, cb) {
			// 监听错误事件
			obj.once(eventname + "fail", function(err) {

				cb.call(this, err);
			});
		};
		obj.emitQ = function(eventname, first) {
			if (events.hasOwnProperty(eventname)) {
				events[eventname].runnable = false;
				var listener = events[eventname].listener;
				if (typeof listener == "function") {
					// 无论如何，触发事件传递的参数最后一个是事件名称
					var args = Array.prototype.slice.call(arguments, 1);
					args.push(eventname);
					listener.apply(this, args || []);
				}
			};
		};
		// 在知道何时队列方法结束的情况下可以调用这个方法删除，也可以不删除，
		obj.waitQend = function(eventname) {
			delete events[eventname];
		}
		return obj;
	}();
	global.eventLt = eventLt;
})(this);

// 测试stepSync
setTimeout(function() {
	eventLt.stepSync(function(done) {
		console.log('第一步，传递1a,1b');
		done("1a", "1b");
	}, function(a, b, done) {
		setTimeout(function() {
			console.log('第三步，发送step1:LeeBox');
			done(eventLt.error("第三步发生错误"));
		}, 1000);
		console.log('第二步，接收并显示1a,1b');
		console.log(a + b);
	}, function(c) {
		console.log('第四步，接收step1:LeeBox');
		console.log(c);
	}).fail(function(err) {
		console.log(err);
	});
}, 0);


setTimeout(function() {
	eventLt.stepSync(function(done) {
		done("2Lee");
	}, function(a, done) {
		setTimeout(function() {
			done("step2:LeeBox +++++++++++++ LeeBox");
		}, 2000);
		console.log(a);
	}, function(d, done) {
		console.log(d);
		console.log("ASDASASDASD");
		done();
	}, function(done) {
		console.log('I am end');
	})
}, 1002);

setTimeout(function() {
	eventLt.step(function(done) {
		console.log('a');
		done("a", "b");
	}).step(function(a, b, done) {
		console.log(a + b);
		setTimeout(function() {
			done("LeeBoxLeeBox");
		}, 2000);
	}).step(function(a, done) {
		console.log(a);
		setTimeout(function() {
			// done("Sliena");
			console.log('测试发生错误');
			done(eventLt.error("捕获测试发生错误"))
		}, 2000);
	}).step(function(s) {
		console.log('永远不会执行到这里');
		console.log(s);
	}).fail(function(err) {
		console.log(err);
		console.log(eventLt._getevents());
	});
}, 2000);

setTimeout(function() {
	eventLt.step(function(done) {
		console.log('a');
		eventLt.once("wait", function() {
			done("aaaaaaaaaaa", "bbbbbbbbbbb");
		});
	}).step(function(a, b, done) {
		console.log(a + b);
		setTimeout(function() {
			done("LeeBoxLeeBox");
		}, 1000);
	}).step(function(a) {
		console.log(a);
	}).fail(function(err) {
		console.log(err);
	});
	eventLt.emit("wait");
}, 5000)


eventLt.series("a", "b", "c", "d", function(a, b, c, d) {
	console.log('series begin');
	console.log(a);
	console.log(b);
	console.log(c);
	console.log(d);
	console.log('series end');
});

eventLt.emit("d", '');
eventLt.emit("b", '');
eventLt.emit("a", '');
eventLt.emit("c", '');

// 顺序执行队列消息
eventLt.waitQ("t", function(done) {
	console.log('顺序执行1');
	done('222222');
})
eventLt.waitQ("t", function(a, done) {
	setTimeout(function() {
		console.log('顺序执行2,接受上一个参数：' + a);
		done('3333333');
	}, 1000)
})
eventLt.waitQ("t", function(a, done) {
	console.log('顺序执行3,接受上一个参数：' + a);
	done(function() {
		console.log('hello world')
	});
})
eventLt.waitQ("t", function(a) {
	setTimeout(function() {
		console.log('顺序执行4');
		a();
	}, 1000)
});


setTimeout(function() {
	eventLt.failQ("tt", function(err) {
		console.log(err);
	});
	for (var i = 0; i < 30; i++) {
		if (i == 0) {
			(function(x) {
				eventLt.waitQ("tt", function(done) {
					setTimeout(function() {
						console.log('顺序执行' + x);
						done(++x);
					}, 1000)
				})
			})(i);
		} else if (i % 2 == 0) {
			(function(x) {
				eventLt.waitQ("tt", function(a, done) {
					setTimeout(function() {
						console.log('顺序执行' + x);
						console.log(a);
						done(++a);
					}, 1000)
				})
			})(i);
		} else if (i % 3 == 0) {
			(function(x) {
				eventLt.waitQ("tt", function(a, done) {
					console.log('顺序执行' + x);
					if (x == 99) {
						console.log(eventLt._getevents());
					}
					console.log(a);
					if (x < 20) {
						done(++a);
					} else {
						console.log("第" + x + "步发生错误!");
						done(eventLt.error("捕获第" + x + "步发生错误!"))
					}
				})
			})(i);
		} else {
			(function(x) {
				eventLt.waitQ("tt", function(a, done) {
					setTimeout(function() {
						console.log('顺序执行' + x);
						console.log(a);
						done(++a);
					}, 100)
				})
			})(i);
		}
	}
}, 7000)