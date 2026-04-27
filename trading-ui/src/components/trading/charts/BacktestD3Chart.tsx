import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface BacktestD3ChartProps {
  data: any[];
  width?: number;
  height?: number;
}

export const BacktestD3Chart: React.FC<BacktestD3ChartProps> = ({ data, width = 800, height = 400 }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data || data.length === 0 || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, data.length - 1])
      .range([0, innerWidth]);

    const yMin = d3.min(data, d => Math.min(d.equity, d.benchmark || d.equity)) * 0.98;
    const yMax = d3.max(data, d => Math.max(d.equity, d.benchmark || d.equity)) * 1.02;

    const yScale = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([innerHeight, 0]);

    const ddScale = d3.scaleLinear()
      .domain([d3.min(data, d => d.drawdown) || -10, 0])
      .range([innerHeight, innerHeight - 60]); // Drawdown sub-chart at bottom

    // Gradients
    const defs = svg.append("defs");

    const equityGradient = defs.append("linearGradient")
      .attr("id", "equity-gradient")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%");

    equityGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#10b981")
      .attr("stop-opacity", 0.3);

    equityGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#10b981")
      .attr("stop-opacity", 0);

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(10).tickFormat(d => `T+${d}`);
    const yAxis = d3.axisLeft(yScale).ticks(6).tickFormat(d => `₹${(Number(d) / 100000).toFixed(1)}L`);

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .attr("class", "axis-x")
      .call(xAxis)
      .selectAll("text")
      .style("fill", "#64748b")
      .style("font-size", "10px")
      .style("font-family", "monospace");

    g.append("g")
      .attr("class", "axis-y")
      .call(yAxis)
      .selectAll("text")
      .style("fill", "#64748b")
      .style("font-size", "10px")
      .style("font-family", "monospace");

    // Grid lines
    g.append("g")
      .attr("class", "grid")
      .attr("opacity", 0.1)
      .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(() => ""));

    // Drawdown Area (Sub-chart)
    const ddArea = d3.area<any>()
      .x((d, i) => xScale(i))
      .y0(innerHeight)
      .y1(d => ddScale(d.drawdown))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(data)
      .attr("fill", "#ef4444")
      .attr("fill-opacity", 0.1)
      .attr("d", ddArea);

    // Benchmark Line
    const benchmarkLine = d3.line<any>()
      .x((d, i) => xScale(i))
      .y(d => yScale(d.benchmark || d.equity))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#475569")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,4")
      .attr("d", benchmarkLine);

    // Equity Line
    const equityLine = d3.line<any>()
      .x((d, i) => xScale(i))
      .y(d => yScale(d.equity))
      .curve(d3.curveMonotoneX);

    const equityArea = d3.area<any>()
      .x((d, i) => xScale(i))
      .y0(innerHeight)
      .y1(d => yScale(d.equity))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(data)
      .attr("fill", "url(#equity-gradient)")
      .attr("d", equityArea);

    const mainPath = g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#10b981")
      .attr("stroke-width", 2.5)
      .attr("d", equityLine);

    // Animation
    const totalLength = (mainPath.node() as SVGPathElement).getTotalLength();
    mainPath
      .attr("stroke-dasharray", totalLength + " " + totalLength)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(2000)
      .ease(d3.easeLinear)
      .attr("stroke-dashoffset", 0);

    // Tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "backtest-tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background", "#0f172a")
      .style("border", "1px solid #1e293b")
      .style("padding", "8px")
      .style("border-radius", "4px")
      .style("color", "#f1f5f9")
      .style("font-size", "11px")
      .style("font-family", "monospace")
      .style("pointer-events", "none")
      .style("z-index", "1000");

    const focus = g.append("g")
      .attr("class", "focus")
      .style("display", "none");

    focus.append("circle").attr("r", 4).attr("fill", "#10b981").attr("stroke", "#fff").attr("stroke-width", 2);
    focus.append("line").attr("y1", 0).attr("y2", innerHeight).attr("stroke", "#334155").attr("stroke-width", 1).attr("stroke-dasharray", "3,3");

    svg.on("mousemove", (event) => {
      const bisect = d3.bisector((d: any) => d.index).left;
      const x0 = xScale.invert(d3.pointer(event)[0] - margin.left);
      const i = bisect(data, x0, 1);
      const d = data[i - 1];

      if (d) {
        focus.style("display", null);
        focus.attr("transform", `translate(${xScale(d.index)}, 0)`);
        focus.select("circle").attr("cy", yScale(d.equity));

        tooltip.style("visibility", "visible")
          .html(`
            <div style="font-weight: bold; margin-bottom: 4px;">T+${d.index}</div>
            <div style="color: #10b981;">Equity: ₹${d.equity.toLocaleString()}</div>
            <div style="color: #ef4444;">Drawdown: ${d.drawdown.toFixed(2)}%</div>
          `)
          .style("top", (event.pageY - 40) + "px")
          .style("left", (event.pageX + 20) + "px");
      }
    });

    svg.on("mouseleave", () => {
      focus.style("display", "none");
      tooltip.style("visibility", "hidden");
    });

    return () => {
      tooltip.remove();
    };
  }, [data, width, height]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-950/20 rounded overflow-hidden">
      <svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" />
    </div>
  );
};
