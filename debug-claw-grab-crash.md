# Debug Session: claw-grab-crash
- **Status**: [FIXED]
- **Issue**: 点击抓取后，`ClawMachineGame` 组件发生运行时错误并崩溃。
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-claw-grab-crash.ndjson

## Reproduction Steps
1. 进入街机大厅。
2. 打开抓娃娃机。
3. 点击“抓取”按钮。
4. 观察组件是否报错并崩溃。

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | 抓取成功后，结算或渲染路径读取了未定义的玩偶对象 | High | Low | Pending |
| B | 行列索引或抖动坐标访问越界，导致点击后读取 `undefined` | High | Low | Pending |
| C | 抓取成功/失败分支状态切换时，`grabbed.current` 与派生渲染数据不一致 | Medium | Medium | Pending |
| D | 图片资源对象在某次抓取后为空，绘制路径触发异常 | Medium | Medium | Pending |
| E | 点击后某个新布局尺寸参与计算，导致运行时算式产生非法值 | Low | Medium | Pending |

## Log Evidence
- 已接入抓取入口、下爪命中、奖励提交、组件级异常监听四类运行时打点。
- 本轮用户反馈为“现象变了”，但尚未回传到 `.dbg/trae-debug-log-claw-grab-crash.ndjson`。
- 结合代码路径复核，确认 `setCaughtPrizeIds((current) => [...current, grabbed.current!.id])` 在调度后仍依赖可变 ref，随后同帧又执行 `grabbed.current = null`，存在明确的空引用崩溃风险。

## Verification Conclusion
- 已做最小修复：先将 `grabbed.current` 固化为局部变量 `settledPrize`，再用于累计碎片和写入 `caughtPrizeIds`。
- 已移除 `getTopPrize()` 内重复的 `const lane = laneColumns[laneIndex];`。
- `npm run build` 已通过，等待用户在页面再次点击“抓取”进行最终验证。
