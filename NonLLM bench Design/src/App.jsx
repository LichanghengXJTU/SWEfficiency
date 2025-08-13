import React, { useState } from "react";

function highlightColor(ratio) {
  if (ratio < 1) return "green";
  if (ratio > 1) return "red";
  return "grey";
}

const App = () => {
  const [prUrl, setPrUrl] = useState("");
  const [workloadCode, setWorkloadCode] = useState("");
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  // Audio context for generating sounds
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  const playSuccessSound = () => {
    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.log('Failed to play success sound:', e);
    }
  };
  
  const playFailureSound = () => {
    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(300, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.log('Failed to play failure sound:', e);
    }
  };
  const [dockerStatus, setDockerStatus] = useState(null);
  const [checkingDocker, setCheckingDocker] = useState(false);
  const [showDownloadInfo, setShowDownloadInfo] = useState(false);
  const [codeValidationErrors, setCodeValidationErrors] = useState([]);


  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // 可以添加一个临时的成功提示
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const handleTabKey = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      
      const textarea = e.target;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      
      // 检查是否有选中的文本
      if (start !== end) {
        // 多行缩进
        const lines = value.split('\n');
        const startLine = value.substring(0, start).split('\n').length - 1;
        const endLine = value.substring(0, end).split('\n').length - 1;
        
        let newValue = '';
        let newCursorPos = start;
        
        for (let i = 0; i < lines.length; i++) {
          if (i >= startLine && i <= endLine) {
            // 在选中行前添加缩进
            newValue += '    ' + lines[i];
            if (i === startLine) {
              newCursorPos += 4; // 调整光标位置
            }
          } else {
            newValue += lines[i];
          }
          if (i < lines.length - 1) {
            newValue += '\n';
          }
        }
        
        setWorkloadCode(newValue);
        
        // 设置新的光标位置
        setTimeout(() => {
          textarea.setSelectionRange(newCursorPos, newCursorPos + (end - start));
        }, 0);
      } else {
        // 单行缩进
        const newValue = value.substring(0, start) + '    ' + value.substring(end);
        setWorkloadCode(newValue);
        
        // 设置新的光标位置
        setTimeout(() => {
          textarea.setSelectionRange(start + 4, start + 4);
        }, 0);
      }
    }
  };

  const hasExtraOutput = (perfOutput) => {
    if (!perfOutput || perfOutput.trim() === '') return false;
    
    // 移除PERF_START:和PERF_END:，只检查中间的内容
    let content = perfOutput.trim();
    if (content.startsWith('PERF_START:')) {
      content = content.substring('PERF_START:'.length).trim();
    }
    if (content.endsWith('PERF_END:')) {
      content = content.substring(0, content.length - 'PERF_END:'.length).trim();
    }
    
    // 检查是否只有标准的四行输出
    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    console.log('hasExtraOutput check:', {
      perfOutput: perfOutput,
      content: content,
      lines: lines,
      lineCount: lines.length
    });
    
    // 标准输出应该只有4行：+ python /tmp/workload.py, Mean:, Std Dev:, + echo
    if (lines.length === 4) {
      const hasPythonCmd = lines.some(line => line.includes('+ python /tmp/workload.py'));
      const hasMean = lines.some(line => line.startsWith('Mean:'));
      const hasStdDev = lines.some(line => line.startsWith('Std Dev:'));
      const hasEcho = lines.some(line => line.includes('+ echo'));
      
      console.log('Standard format check:', {
        hasPythonCmd,
        hasMean,
        hasStdDev,
        hasEcho,
        allMatch: hasPythonCmd && hasMean && hasStdDev && hasEcho
      });
      
      // 如果所有四行都符合标准格式，则没有额外输出
      if (hasPythonCmd && hasMean && hasStdDev && hasEcho) {
        return false;
      }
    }
    
    // 如果行数不是4，或者四行中有不符合标准的，说明有额外输出
    return true;
  };

  const filterOutputForDisplay = (perfOutput) => {
    if (!perfOutput || perfOutput.trim() === '') return '';
    
    // 找到第一个PERF_START和对应的PERF_END
    const startIndex = perfOutput.indexOf('PERF_START:');
    if (startIndex === -1) return perfOutput;
    
    const endIndex = perfOutput.indexOf('PERF_END:', startIndex);
    if (endIndex === -1) return perfOutput;
    
    // 提取第一个PERF_START/PERF_END块的内容
    let content = perfOutput.substring(startIndex + 'PERF_START:'.length, endIndex).trim();
    
    const lines = content.split('\n');
    const filteredLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue;
      
      // 跳过不需要的行
      if (line.includes('+ python /tmp/workload.py') || 
          line.includes('+ echo')) {
        continue;
      }
      
      // 保留其他所有行（包括Mean、Std Dev和错误信息）
      filteredLines.push(lines[i]);
    }
    
    return filteredLines.join('\n');
  };

  const filterOutputForDisplayAfter = (perfOutput) => {
    if (!perfOutput || perfOutput.trim() === '') return '';
    
    // 找到第二个PERF_START和对应的PERF_END
    const firstStartIndex = perfOutput.indexOf('PERF_START:');
    if (firstStartIndex === -1) return perfOutput;
    
    const secondStartIndex = perfOutput.indexOf('PERF_START:', firstStartIndex + 1);
    if (secondStartIndex === -1) return perfOutput;
    
    const endIndex = perfOutput.indexOf('PERF_END:', secondStartIndex);
    if (endIndex === -1) return perfOutput;
    
    // 提取第二个PERF_START/PERF_END块的内容
    let content = perfOutput.substring(secondStartIndex + 'PERF_START:'.length, endIndex).trim();
    
    const lines = content.split('\n');
    const filteredLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue;
      
      // 跳过不需要的行
      if (line.includes('+ python /tmp/workload.py') || 
          line.includes('+ echo')) {
        continue;
      }
      
      // 保留其他所有行（包括Mean、Std Dev和错误信息）
      filteredLines.push(lines[i]);
    }
    
    return filteredLines.join('\n');
  };





  const validateWorkloadCode = (code) => {
    const errors = [];
    const codeLower = code.toLowerCase();
    
    // 检查是否包含必需的import
    if (!codeLower.includes('import timeit') && !codeLower.includes('from timeit import')) {
      errors.push('forgetting import timeit');
    }
    
    if (!codeLower.includes('import statistics') && !codeLower.includes('from statistics import')) {
      errors.push('forgetting import statistics');
    }
    
    // 检查是否包含timeit.repeat调用
    if (!codeLower.includes('timeit.repeat')) {
      errors.push('forgetting test workload');
    }
    
    // 检查是否包含两个print语句
    const hasMeanPrint = codeLower.includes('print("mean:') || codeLower.includes('statistics.mean');
    const hasStdPrint = codeLower.includes('print("std dev:') || codeLower.includes('statistics.stdev');
    
    if (!hasMeanPrint) {
      errors.push('forgetting print the mean result');
    }
    
    if (!hasStdPrint) {
      errors.push('forgetting print the std dev result');
    }
    
    return errors;
  };

  const clearAllInputs = () => {
    setPrUrl("");
    setWorkloadCode("");
    setCodeValidationErrors([]);
    // 不清除 result 和 error，保持输出显示
  };

  const checkDockerStatus = async () => {
    setCheckingDocker(true);
    try {
      const res = await fetch("http://localhost:5679/check_docker");
      const data = await res.json();
      setDockerStatus(data);
    } catch (e) {
      setDockerStatus({
        installed: false,
        running: false,
        permissions: false,
        message: "Cannot connect to Docker check service",
        setup_instructions: []
      });
    } finally {
      setCheckingDocker(false);
    }
  };

  const handleRun = async () => {
    if (!dockerStatus?.permissions) {
      setError("Docker permissions not configured, please check Docker status first");
      return;
    }
    
    setRunning(true);
    setStopping(false);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("http://localhost:5678/run_benchmark", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          pr_url: prUrl,
          workload_code: workloadCode,
        }),
      });
      const data = await res.json();
      setResult(data);
      
      // Play sound based on success/failure
      if (data.mean_before && data.mean_after && data.std_before && data.std_after) {
        playSuccessSound();
      } else {
        playFailureSound();
      }
    } catch (e) {
      setError("Run failed: " + e);
      playFailureSound();
    } finally {
      setRunning(false);
      setStopping(false);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    try {
      await fetch("http://localhost:5678/stop_benchmark", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
      });
      setError("Benchmark stopped by user");
      playFailureSound(); // Play failure sound when stopped by user
    } catch (e) {
      setError("Failed to stop benchmark: " + e);
      playFailureSound();
    } finally {
      setRunning(false);
      setStopping(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #A51C30 0%, #8B0000 50%, #660000 100%)",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      position: "relative",
      overflowX: "hidden",
      overflowY: "auto",
      backgroundAttachment: "fixed",
      overscrollBehavior: "none"
    }}>

      {/* Header with Logo */}
      <div style={{
        background: "white",
        borderBottom: "1px solid rgba(165, 28, 48, 0.2)",
        padding: "20px 0",
        boxShadow: "0 4px 30px rgba(165, 28, 48, 0.15)",
        position: "relative",
        zIndex: 10
      }}>
        <div style={{maxWidth: 1200, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between"}}>
          <div style={{display: "flex", alignItems: "center", gap: "20px", marginLeft: "-120px"}}>
            <div style={{
              width: "236px",
              height: "80px",
              borderRadius: "12px",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "white"
            }}>
              <img 
                src="/Edge Computing Lab Logo.png" 
                alt="Edge Computing Lab Logo"
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  width: "auto",
                  height: "auto"
                }}
              />
      </div>
      <div>
              <h1 style={{
                margin: 0,
                fontSize: "32px",
                fontWeight: "800",
                color: "#A51C30",
                letterSpacing: "-0.5px"
              }}>
                Performance Benchmark Platform
              </h1>
              <p style={{
                margin: "4px 0 0 0",
                fontSize: "20px",
                color: "#666",
                fontWeight: "600"
              }}>
                Edge Computing Lab
              </p>
              <p style={{
                margin: "2px 0 0 0",
                fontSize: "12px",
                color: "#A51C30",
                fontWeight: "600",
                fontStyle: "italic"
              }}>
                Harvard John A. Paulson School of Engineering and Applied Sciences
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{maxWidth: 1200, margin: "0 auto", padding: "40px 20px", position: "relative"}}>
        {/* Docker Status Check Section */}
        <div style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px)",
          borderRadius: "20px",
          padding: "30px",
          marginBottom: "30px",
          boxShadow: "0 8px 40px rgba(165, 28, 48, 0.15)",
          border: "1px solid rgba(165, 28, 48, 0.1)"
        }}>
          <h3 style={{
            margin: "0 0 20px 0",
            fontSize: "22px",
            fontWeight: "700",
            color: "#A51C30",
            display: "flex",
            alignItems: "center",
            gap: "10px"
          }}>
            <span style={{fontSize: "24px"}}>🔧</span>
            Docker Status Check
          </h3>
          <button 
            onClick={checkDockerStatus} 
            disabled={checkingDocker}
            style={{
              padding: "14px 28px",
              marginBottom: "20px",
              background: checkingDocker ? "#e0e0e0" : "linear-gradient(45deg, #A51C30, #8B0000)",
              color: "white",
              border: "none",
              borderRadius: "12px",
              fontSize: "15px",
              fontWeight: "600",
              cursor: checkingDocker ? "not-allowed" : "pointer",
              transition: "all 0.3s ease",
              boxShadow: checkingDocker ? "none" : "0 6px 20px rgba(165, 28, 48, 0.4)",
              border: "1px solid rgba(165, 28, 48, 0.2)"
            }}
          >
            {checkingDocker ? "Checking..." : "Check Docker Status"}
          </button>
          
          {dockerStatus && (
      <div>
              <div style={{marginBottom: "15px"}}>
                <strong style={{color: "#333"}}>Status: </strong>
                <span style={{
                  color: dockerStatus.permissions ? "#059669" : "#DC2626",
                  fontWeight: "600",
                  padding: "6px 14px",
                  borderRadius: "20px",
                  background: dockerStatus.permissions ? "rgba(5, 150, 105, 0.1)" : "rgba(220, 38, 38, 0.1)",
                  fontSize: "14px",
                  border: "1px solid",
                  borderColor: dockerStatus.permissions ? "rgba(5, 150, 105, 0.3)" : "rgba(220, 38, 38, 0.3)"
                }}>
                  {dockerStatus.permissions ? "✅ Normal" : "❌ Configuration Required"}
                </span>
              </div>
              <div style={{marginBottom: "15px", color: "#666"}}>
                <strong>Message: </strong>{dockerStatus.message}
      </div>
      </div>
          )}
      </div>

        {/* Main Form */}
        <div style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px)",
          borderRadius: "20px",
          padding: "40px",
          marginBottom: "30px",
          boxShadow: "0 8px 40px rgba(165, 28, 48, 0.15)",
          border: "1px solid rgba(165, 28, 48, 0.1)"
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "30px"
          }}>
            <h2 style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: "800",
              color: "#A51C30",
              letterSpacing: "-0.5px"
            }}>
              Performance Benchmark Configuration
            </h2>
            <button 
              onClick={clearAllInputs}
              disabled={running}
              style={{
                padding: "10px 20px",
                background: running ? "#e0e0e0" : "linear-gradient(45deg, #666, #888)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: running ? "not-allowed" : "pointer",
                transition: "all 0.3s ease",
                boxShadow: running ? "none" : "0 4px 15px rgba(0, 0, 0, 0.2)"
              }}
              onMouseOver={(e) => !running && (e.target.style.background = "linear-gradient(45deg, #555, #777)")}
              onMouseOut={(e) => !running && (e.target.style.background = "linear-gradient(45deg, #666, #888)")}
            >
              Clear All
      </button>
          </div>

          <div style={{display: "grid", gap: "25px"}}>
          <div>
              <label style={{
                display: "block",
                marginBottom: "10px",
                fontSize: "15px",
                fontWeight: "600",
                color: "#A51C30"
              }}>
                GitHub PR URL or Docker Image Name:
              </label>
              <input 
                type="text"
                style={{
                  width: "100%",
                  padding: "14px 18px",
                  border: "2px solid rgba(165, 28, 48, 0.2)",
                  borderRadius: "12px",
                  fontSize: "14px",
                  transition: "all 0.3s ease",
                  background: running ? "#f9fafb" : "white",
                  opacity: running ? 0.6 : 1,
                  outline: "none"
                }}
                value={prUrl} 
                onChange={e=>setPrUrl(e.target.value)} 
                disabled={running}
                onFocus={(e) => e.target.style.borderColor = "#A51C30"}
                onBlur={(e) => e.target.style.borderColor = "rgba(165, 28, 48, 0.2)"}
              />
          </div>

          <div>
              <label style={{
                display: "block",
                marginBottom: "10px",
                fontSize: "15px",
                fontWeight: "600",
                color: "#A51C30"
              }}>
                Workload Code:
              </label>
              <textarea 
                style={{
                  width: "100%",
                  height: `${Math.max(120, (workloadCode.split('\n').length + 1) * 20)}px`,
                  padding: "14px 18px",
                  border: "2px solid rgba(165, 28, 48, 0.2)",
                  borderRadius: "12px",
                  fontSize: "14px",
                  fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
                  resize: "none",
                  transition: "all 0.3s ease",
                  background: running ? "#f9fafb" : "white",
                  opacity: running ? 0.6 : 1,
                  outline: "none",
                  overflow: "hidden"
                }}
                value={workloadCode} 
                onChange={(e) => {
                  setWorkloadCode(e.target.value);
                  const errors = validateWorkloadCode(e.target.value);
                  setCodeValidationErrors(errors);
                }}
                onKeyDown={handleTabKey}
                disabled={running}
                onFocus={(e) => e.target.style.borderColor = "#A51C30"}
                onBlur={(e) => e.target.style.borderColor = "rgba(165, 28, 48, 0.2)"}
              />
              {codeValidationErrors.length > 0 && (
                <div style={{
                  marginTop: "10px",
                  background: "white",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  border: "2px solid #DC2626",
                  boxShadow: "0 4px 12px rgba(220, 38, 38, 0.2)"
                }}>
                  <div style={{fontWeight: "600", color: "#DC2626", marginBottom: "8px"}}>
                    ⚠️ Code Validation Errors:
                  </div>
                  <ul style={{margin: 0, paddingLeft: "20px", color: "#333"}}>
                    {codeValidationErrors.map((error, index) => (
                      <li key={index} style={{marginBottom: "4px", fontSize: "14px"}}>
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>

            <div style={{textAlign: "center", marginTop: "20px"}}>
              <div style={{display: "flex", gap: "15px", justifyContent: "center"}}>
                <button 
                  style={{
                    padding: "18px 50px",
                    background: running ? "#e0e0e0" : "linear-gradient(45deg, #A51C30, #8B0000)",
                    color: "white",
                    border: "none",
                    borderRadius: "16px",
                    fontSize: "18px",
                    fontWeight: "700",
                    cursor: running ? "not-allowed" : "pointer",
                    transition: "all 0.3s ease",
                    boxShadow: running ? "none" : "0 10px 30px rgba(165, 28, 48, 0.4)",
                    minWidth: "250px",
                    border: "1px solid rgba(165, 28, 48, 0.3)"
                  }}
                  onClick={handleRun} 
                  disabled={running}
                >
                  {running ? "⏳ Running..." : "🚀 Run Benchmark"}
                </button>
                {running && (
                  <button 
                    style={{
                      padding: "18px 50px",
                      background: stopping ? "#e0e0e0" : "linear-gradient(45deg, #DC2626, #B91C1C)",
                      color: "white",
                      border: "none",
                      borderRadius: "16px",
                      fontSize: "18px",
                      fontWeight: "700",
                      cursor: stopping ? "not-allowed" : "pointer",
                      transition: "all 0.3s ease",
                      boxShadow: stopping ? "none" : "0 10px 30px rgba(220, 38, 38, 0.4)",
                      minWidth: "150px",
                      border: "1px solid rgba(220, 38, 38, 0.3)"
                    }}
                    onClick={handleStop}
                    disabled={stopping}
                  >
                    {stopping ? "⏳ Stopping..." : "🛑 Stop"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {result && (
            <div style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(20px)",
            borderRadius: "20px",
            padding: "40px",
            marginBottom: "30px",
            boxShadow: "0 8px 40px rgba(165, 28, 48, 0.15)",
            border: "1px solid rgba(165, 28, 48, 0.1)",
            maxWidth: "100%",
            overflowX: "auto"
          }}>
            <h3 style={{
              margin: "0 0 30px 0",
              fontSize: "26px",
              fontWeight: "800",
              color: "#A51C30",
              textAlign: "center",
              letterSpacing: "-0.5px"
            }}>
              📊 Benchmark Results
            </h3>

            <div style={{display: "grid", gap: "25px"}}>
              {!result.is_direct_image && (
              <div style={{
                background: "rgba(165, 28, 48, 0.05)",
                padding: "20px",
                borderRadius: "16px",
                border: "1px solid rgba(165, 28, 48, 0.2)"
              }}>
                <div style={{fontWeight: "600", color: "#A51C30", marginBottom: "8px"}}>
                  🐳 Image Name:
                </div>
                <div style={{fontFamily: "'Fira Code', monospace", fontSize: "14px"}}>
                  {result.image_tag}
                </div>
              </div>
              )}

              <div style={{
                background: "rgba(165, 28, 48, 0.05)",
                padding: "20px",
                borderRadius: "16px",
                border: "1px solid rgba(165, 28, 48, 0.2)"
              }}>
                <div style={{fontWeight: "600", color: "#A51C30", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px"}}>
                  <span style={{flex: "1", minWidth: "0"}}>📋 Docker Command:</span>
                  <button 
                    onClick={() => copyToClipboard(result.docker_command)}
                    style={{
                      padding: "6px 12px",
                      background: "#A51C30",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      whiteSpace: "nowrap",
                      flexShrink: "0"
                    }}
                    onMouseOver={(e) => e.target.style.background = "#8B0000"}
                    onMouseOut={(e) => e.target.style.background = "#A51C30"}
                  >
                    📋 Copy
                  </button>
                </div>
                <div style={{
                  background: "#f8fafc",
                  padding: "16px",
                  borderRadius: "12px",
                  fontSize: "13px",
                  fontFamily: "'Fira Code', monospace",
                  border: "1px solid #e2e8f0",
                  overflowX: "auto",
                  wordBreak: "break-all",
                  maxWidth: "100%"
                }}>
                  {result.docker_command}
                </div>
                <div style={{fontSize: "12px", color: "#64748b", marginTop: "8px"}}>
                  Note: Replace &lt;REPLACE_ME&gt; with the full path to your workload.py file
                </div>
              </div>

              {result.download_info && (
                <div style={{
                  background: "rgba(165, 28, 48, 0.05)",
                  padding: "20px",
                  borderRadius: "16px",
                  border: "1px solid rgba(165, 28, 48, 0.2)"
                }}>
                  <div style={{fontWeight: "600", color: "#A51C30", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px"}}>
                    <span style={{flex: "1", minWidth: "0"}}>📥 Download Info:</span>
                    <div style={{display: "flex", gap: "8px", flexShrink: "0"}}>
                                              <button 
                          onClick={() => setShowDownloadInfo(!showDownloadInfo)}
                          style={{
                            padding: "6px 12px",
                            background: showDownloadInfo ? "#666" : "#A51C30",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "12px",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            whiteSpace: "nowrap",
                            flexShrink: "0"
                          }}
                        onMouseOver={(e) => e.target.style.background = showDownloadInfo ? "#555" : "#8B0000"}
                        onMouseOut={(e) => e.target.style.background = showDownloadInfo ? "#666" : "#A51C30"}
                      >
                        {showDownloadInfo ? "👁️ Hide" : "👁️ Show"}
                      </button>
                      <button 
                        onClick={() => copyToClipboard(result.download_info)}
                        style={{
                          padding: "6px 12px",
                          background: "#A51C30",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "12px",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          whiteSpace: "nowrap"
                        }}
                        onMouseOver={(e) => e.target.style.background = "#8B0000"}
                        onMouseOut={(e) => e.target.style.background = "#A51C30"}
                      >
                        📋 Copy
                      </button>
                    </div>
                  </div>
                  {showDownloadInfo && (
                    <div style={{
                      background: "#f8fafc",
                      padding: "16px",
                      borderRadius: "12px",
                      fontSize: "13px",
                      fontFamily: "'Fira Code', monospace",
                      border: "1px solid #e2e8f0",
                      overflowX: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      maxHeight: "400px",
                      overflowY: "auto",
                      maxWidth: "100%"
                    }}>
                      {result.download_info}
                    </div>
                  )}
                </div>
              )}

              {/* 只有当有mean和std时才显示简化的结果框 */}
              {(result.mean_before && result.std_before && result.mean_after && result.std_after) && (
                <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px"}}>
                  <div style={{
                    background: "rgba(165, 28, 48, 0.05)",
                    padding: "20px",
                    borderRadius: "16px",
                    border: "1px solid rgba(165, 28, 48, 0.2)"
                  }}>
                    <div style={{fontWeight: "600", color: "#A51C30", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                      <span>📊 Initial Results:</span>
                      <button 
                        onClick={() => copyToClipboard(`Before Mean: ${result.mean_before}\nBefore SD: ${result.std_before}`)}
                        style={{
                          padding: "6px 12px",
                          background: "#A51C30",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "12px",
                          cursor: "pointer",
                          transition: "all 0.2s ease"
                        }}
                        onMouseOver={(e) => e.target.style.background = "#8B0000"}
                        onMouseOut={(e) => e.target.style.background = "#A51C30"}
                      >
                        📋 Copy
                      </button>
                    </div>
                    <div style={{
                      background: "white",
                      padding: "16px",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0"
                    }}>
                      <div style={{fontSize: "14px", fontWeight: "600"}}>
                        Mean: {result.mean_before}
                      </div>
                      <div style={{fontSize: "14px", fontWeight: "600"}}>
                        Std: {result.std_before}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    background: "rgba(165, 28, 48, 0.05)",
                    padding: "20px",
                    borderRadius: "16px",
                    border: "1px solid rgba(165, 28, 48, 0.2)"
                  }}>
                    <div style={{fontWeight: "600", color: "#A51C30", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                      <span>📊 Results After Patch:</span>
                      <button 
                        onClick={() => copyToClipboard(`After Mean: ${result.mean_after}\nAfter SD: ${result.std_after}`)}
                        style={{
                          padding: "6px 12px",
                          background: "#A51C30",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "12px",
                          cursor: "pointer",
                          transition: "all 0.2s ease"
                        }}
                        onMouseOver={(e) => e.target.style.background = "#8B0000"}
                        onMouseOut={(e) => e.target.style.background = "#A51C30"}
                      >
                        📋 Copy
                      </button>
                    </div>
                    <div style={{
                      background: "white",
                      padding: "16px",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0"
                    }}>
                      <div style={{fontSize: "14px", fontWeight: "600"}}>
                        Mean: {result.mean_after}
                      </div>
                      <div style={{fontSize: "14px", fontWeight: "600"}}>
                        Std: {result.std_after}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 显示完整的PERF_START到PERF_END内容（如果有额外输出或没有mean/std） */}
              {(result.perf_output_before && (hasExtraOutput(result.perf_output_before) || !result.mean_before || !result.std_before)) && (
                <div style={{
                  background: "rgba(165, 28, 48, 0.05)",
                  padding: "20px",
                  borderRadius: "16px",
                  border: "1px solid rgba(165, 28, 48, 0.2)"
                }}>
                  <div style={{fontWeight: "600", color: "#A51C30", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px"}}>
                    <span style={{flex: "1", minWidth: "0"}}>📋 Initial Results (Full):</span>
                    <button 
                      onClick={() => copyToClipboard(result.perf_output_before)}
                      style={{
                        padding: "6px 12px",
                        background: "#A51C30",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        flexShrink: "0"
                      }}
                      onMouseOver={(e) => e.target.style.background = "#8B0000"}
                      onMouseOut={(e) => e.target.style.background = "#A51C30"}
                    >
                      📋 Copy
                    </button>
                  </div>
                  <div style={{
                    background: "white",
                    padding: "16px",
                    borderRadius: "12px",
                    fontSize: "13px",
                    fontFamily: "'Fira Code', monospace",
                    border: "1px solid #e2e8f0",
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                    maxHeight: "300px",
                    overflowY: "auto",
                    maxWidth: "100%",
                    wordBreak: "break-all"
                  }}>
                    {filterOutputForDisplay(result.perf_output_before)}
                  </div>
                </div>
              )}

              {(result.perf_output_after && (hasExtraOutput(result.perf_output_after) || !result.mean_after || !result.std_after)) && (
                <div style={{
                  background: "rgba(165, 28, 48, 0.05)",
                  padding: "20px",
                  borderRadius: "16px",
                  border: "1px solid rgba(165, 28, 48, 0.2)"
                }}>
                  <div style={{fontWeight: "600", color: "#A51C30", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px"}}>
                    <span style={{flex: "1", minWidth: "0"}}>📋 After Patch (Full):</span>
                    <button 
                      onClick={() => copyToClipboard(result.perf_output_after)}
                      style={{
                        padding: "6px 12px",
                        background: "#A51C30",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        flexShrink: "0"
                      }}
                      onMouseOver={(e) => e.target.style.background = "#8B0000"}
                      onMouseOut={(e) => e.target.style.background = "#A51C30"}
                    >
                      📋 Copy
                    </button>
                  </div>
                  <div style={{
                    background: "white",
                    padding: "16px",
                    borderRadius: "12px",
                    fontSize: "13px",
                    fontFamily: "'Fira Code', monospace",
                    border: "1px solid #e2e8f0",
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                    maxHeight: "300px",
                    overflowY: "auto",
                    maxWidth: "100%",
                    wordBreak: "break-all"
                  }}>
                    {filterOutputForDisplayAfter(result.perf_output_after)}
                  </div>
                </div>
              )}

              {result.ratio && (
                <div style={{
                  background: "rgba(165, 28, 48, 0.05)",
                  padding: "20px",
                  borderRadius: "16px",
                  border: "1px solid rgba(165, 28, 48, 0.2)"
                }}>
                  <div style={{fontWeight: "600", color: "#A51C30", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                    <span>📈 Performance Comparison:</span>
                    <button 
                      onClick={() => {
                        const improvement = result.ratio < 1 ? 
                          `-${((1 - result.ratio) * 100).toFixed(2)}` : 
                          `+${((result.ratio - 1) * 100).toFixed(2)}`;
                        copyToClipboard(`Improvement: ${improvement}%`);
                      }}
                      style={{
                        padding: "6px 12px",
                        background: "#A51C30",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        cursor: "pointer",
                        transition: "all 0.2s ease"
                      }}
                      onMouseOver={(e) => e.target.style.background = "#8B0000"}
                      onMouseOut={(e) => e.target.style.background = "#A51C30"}
                    >
                      📋 Copy
                    </button>
                  </div>
                  <div style={{
                    padding: "16px",
                    borderRadius: "12px",
                    fontSize: "16px",
                    fontWeight: "700",
                    textAlign: "center",
                    background: highlightColor(result.ratio) === "green" ? "rgba(5, 150, 105, 0.1)" :
                                highlightColor(result.ratio) === "red" ? "rgba(220, 38, 38, 0.1)" : "rgba(107, 114, 128, 0.1)",
                    color: highlightColor(result.ratio) === "green" ? "#059669" :
                           highlightColor(result.ratio) === "red" ? "#DC2626" : "#6B7280",
                    border: "2px solid",
                    borderColor: highlightColor(result.ratio) === "green" ? "rgba(5, 150, 105, 0.3)" :
                                 highlightColor(result.ratio) === "red" ? "rgba(220, 38, 38, 0.3)" : "rgba(107, 114, 128, 0.3)"
                  }}>
                    {result.ratio < 1 ? (
                      <>Improvement: -{((1 - result.ratio) * 100).toFixed(2)}% (🚀 Faster)</>
                    ) : result.ratio > 1 ? (
                      <>Improvement: +{((result.ratio - 1) * 100).toFixed(2)}% (🐌 Slower)</>
                    ) : (
                      <>Improvement: 0.00% (➡️ Same)</>
                    )}
                  </div>
                </div>
              )}

              {result.error && (
                <div style={{
                  background: "rgba(220, 38, 38, 0.1)",
                  padding: "20px",
                  borderRadius: "16px",
                  border: "2px solid rgba(220, 38, 38, 0.3)",
                  boxShadow: "0 4px 15px rgba(220, 38, 38, 0.2)"
                }}>
                  <div style={{fontWeight: "600", color: "#DC2626", marginBottom: "8px"}}>
                    ❌ Error:
                  </div>
                  <div style={{color: "#DC2626", fontSize: "14px"}}>
                    {result.error}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div style={{
            background: "white",
            padding: "20px",
            borderRadius: "16px",
            border: "3px solid #DC2626",
            boxShadow: "0 8px 25px rgba(220, 38, 38, 0.3)",
            marginTop: "20px"
          }}>
            <div style={{fontWeight: "600", color: "#DC2626", marginBottom: "8px"}}>
              ❌ Error:
            </div>
            <div style={{color: "#333", fontSize: "14px"}}>
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        background: "white",
        borderTop: "1px solid rgba(165, 28, 48, 0.2)",
        padding: "20px 0",
        marginTop: "40px"
      }}>
        <div style={{maxWidth: 1200, margin: "0 auto", padding: "0 20px", textAlign: "center"}}>
          <p style={{
            margin: 0,
            fontSize: "14px",
            color: "#666",
            fontWeight: "500"
          }}>
            © 2024 Edge Computing Lab, Harvard John A. Paulson School of Engineering and Applied Sciences
          </p>
        </div>
        </div>
    </div>
  );
};

export default App;

