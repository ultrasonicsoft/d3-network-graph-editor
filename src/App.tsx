import React, { Component } from 'react';
import * as d3 from "d3";

import './App.css';

class App extends Component {
  svgRef: React.RefObject<any>;
  width = 960;
  height = 500;
  colors = d3.scaleOrdinal(d3.schemeCategory10);

  svg: any;

  nodes = new Array<any>();
  lastNodeId: number = 0;
  links = new Array<any>();
  force: any;
  drag: any;
  dragLine: any;
  path: any;
  circle: any;

  // mouse event vars
  selectedNode: any = null;
  selectedLink: any = null;
  mousedownLink: any = null;
  mousedownNode: any = null;
  mouseupNode: any = null;

  // only respond once per keydown
  lastKeyDown = -1;

  constructor(props: any) {
    super(props);
    this.svgRef = React.createRef();
  }

  componentDidMount() {
    let size = 500;
    this.svg = d3.select(this.svgRef.current)
      .append("svg")
      .attr("width", this.width)
      .attr("height", this.height)
      .on('contextmenu', (event, d) => { event.preventDefault(); })

    // set up initial nodes and links
    //  - nodes are known by 'id', not by index in array.
    //  - reflexive edges are indicated on the node (as a bold black circle).
    //  - links are always source < target; edge directions are set by 'left' and 'right'.
    this.nodes = [
      { id: 0, reflexive: false },
      { id: 1, reflexive: true },
      { id: 2, reflexive: false }
    ];

    this.lastNodeId = 2;

    this.links = [
      { source: this.nodes[0], target: this.nodes[1], left: false, right: true },
      { source: this.nodes[1], target: this.nodes[2], left: false, right: true }
    ];

    // init D3 force layout
    this.force = d3.forceSimulation()
      .force('link', d3.forceLink().id((d: any) => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('x', d3.forceX(this.width / 2))
      .force('y', d3.forceY(this.height / 2))
      .on('tick', () => this.tick());

    // init D3 drag support
    this.drag = d3.drag()
      // Mac Firefox doesn't distinguish between left/right click when Ctrl is held... 
      .filter((event, d) => event.button === 0 || event.button === 2)
      .on('start', (event, d: any) => {
        if (!event.active) this.force.alphaTarget(0.3).restart();

        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d: any) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d: any) => {
        if (!event.active) this.force.alphaTarget(0);

        d.fx = null;
        d.fy = null;
      });

    // define arrow markers for graph links
    this.svg.append('svg:defs').append('svg:marker')
      .attr('id', 'end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 6)
      .attr('markerWidth', 3)
      .attr('markerHeight', 3)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#000');

    this.svg.append('svg:defs').append('svg:marker')
      .attr('id', 'start-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 4)
      .attr('markerWidth', 3)
      .attr('markerHeight', 3)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M10,-5L0,0L10,5')
      .attr('fill', '#000');

    // line displayed when dragging new nodes
    this.dragLine = this.svg.append('svg:path')
      .attr('class', 'link dragline hidden')
      .attr('d', 'M0,0L0,0');

    // handles to link and node element groups
    this.path = this.svg.append('svg:g').selectAll('path');
    this.circle = this.svg.append('svg:g').selectAll('g');

    // app starts here
    this.svg.on('mousedown', (event: any, d: any) => this.mousedown(event, d))
      .on('mousemove', (event: any, d: any) => this.mousemove(event, d))
      .on('mouseup', (event: any, d: any) => this.mouseup(event, d));

    d3.select(window)
      .on('keydown', (event: any, d: any) => this.keydown(event, d))
      .on('keyup', (event: any, d: any) => this.keyup(event, d));

    this.restart();
  }

  resetMouseVars() {
    this.mousedownNode = null;
    this.mouseupNode = null;
    this.mousedownLink = null;
  }

  // update force layout (called automatically each iteration)
  tick() {
    // draw directed edges with proper padding from node centers
    this.path.attr('d', (d: any) => {
      const deltaX = d.target.x - d.source.x;
      const deltaY = d.target.y - d.source.y;
      const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const normX = deltaX / dist;
      const normY = deltaY / dist;
      const sourcePadding = d.left ? 17 : 12;
      const targetPadding = d.right ? 17 : 12;
      const sourceX = d.source.x + (sourcePadding * normX);
      const sourceY = d.source.y + (sourcePadding * normY);
      const targetX = d.target.x - (targetPadding * normX);
      const targetY = d.target.y - (targetPadding * normY);

      return `M${sourceX},${sourceY}L${targetX},${targetY}`;
    });

    this.circle.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
  }

  // update graph (called when needed)
  restart() {
    // path (link) group
    this.path = this.path.data(this.links);

    // update existing links
    this.path.classed('selected', (d: any) => d === this.selectedLink)
      .style('marker-start', (d: any) => d.left ? 'url(#start-arrow)' : '')
      .style('marker-end', (d: any) => d.right ? 'url(#end-arrow)' : '');

    // remove old links
    this.path.exit().remove();

    // add new links
    this.path = this.path.enter().append('svg:path')
      .attr('class', 'link')
      .classed('selected', (d: any) => d === this.selectedLink)
      .style('marker-start', (d: any) => d.left ? 'url(#start-arrow)' : '')
      .style('marker-end', (d: any) => d.right ? 'url(#end-arrow)' : '')
      .on('mousedown', (event: any, d: any) => {
        if (event.ctrlKey) return;

        // select link
        this.mousedownLink = d;
        this.selectedLink = (this.mousedownLink === this.selectedLink) ? null : this.mousedownLink;
        this.selectedNode = null;
        this.restart();
      })
      .merge(this.path);

    // circle (node) group
    // NB: the function arg is crucial here! nodes are known by id, not by index!
    this.circle = this.circle.data(this.nodes, (d: any) => d.id);

    // update existing nodes (reflexive & selected visual states)
    this.circle.selectAll('circle')
      .style('fill', (d: any) => (d === this.selectedNode) ? d3.rgb(this.colors(d.id)).brighter().toString() : this.colors(d.id))
      .classed('reflexive', (d: any) => d.reflexive);

    // remove old nodes
    this.circle.exit().remove();

    // add new nodes
    const g = this.circle.enter().append('svg:g');

    g.append('svg:circle')
      .attr('class', 'node')
      .attr('r', 12)
      .style('fill', (d: any) => (d === this.selectedNode) ? d3.rgb(this.colors(d.id)).brighter().toString() : this.colors(d.id))
      .style('stroke', (d: any) => d3.rgb(this.colors(d.id)).darker().toString())
      .classed('reflexive', (d: any) => d.reflexive)
      .on('mouseover', (event: any, d: any) => {
        if (!this.mousedownNode || d === this.mousedownNode) return;
        // enlarge target node
        d3.select(event.currentTarget).attr('transform', 'scale(1.1)');
      })
      .on('mouseout', (event: any, d: any) => {
        if (!this.mousedownNode || d === this.mousedownNode) return;
        // unenlarge target node
        d3.select(event?.currentTarget).attr('transform', '');
      })
      .on('mousedown', (event: any, d: any) => {
        if (event.ctrlKey) return;

        // select node
        this.mousedownNode = d;
        this.selectedNode = (this.mousedownNode === this.selectedNode) ? null : this.mousedownNode;
        this.selectedLink = null;

        // reposition drag line
        this.dragLine
          .style('marker-end', 'url(#end-arrow)')
          .classed('hidden', false)
          .attr('d', `M${this.mousedownNode.x},${this.mousedownNode.y}L${this.mousedownNode.x},${this.mousedownNode.y}`);

        this.restart();
      })
      .on('mouseup', (event: any, d: any) => {
        if (!this.mousedownNode) return;

        // needed by FF
        this.dragLine
          .classed('hidden', true)
          .style('marker-end', '');

        // check for drag-to-self
        this.mouseupNode = d;
        if (this.mouseupNode === this.mousedownNode) {
          this.resetMouseVars();
          return;
        }

        // unenlarge target node
        d3.select(event.currentTarget).attr('transform', '');

        // add link to graph (update if exists)
        // NB: links are strictly source < target; arrows separately specified by booleans
        const isRight = this.mousedownNode.id < this.mouseupNode.id;
        const source = isRight ? this.mousedownNode : this.mouseupNode;
        const target = isRight ? this.mouseupNode : this.mousedownNode;

        let link = this.links.filter((l: any) => l.source === source && l.target === target)[0];
        if (link) {
          link[isRight ? 'right' : 'left'] = true;
        } else {
          this.links.push({ source, target, left: !isRight, right: isRight });
        }

        // select new link
        this.selectedLink = link;
        this.selectedNode = null;
        this.restart();
      });

    // show node IDs
    g.append('svg:text')
      .attr('x', 0)
      .attr('y', 4)
      .attr('class', 'id')
      .text((d: any) => d.id);

    this.circle = g.merge(this.circle);

    // set the graph in motion
    this.force
      .nodes(this.nodes)
      .force('link').links(this.links);

    this.force.alphaTarget(0.3).restart();
  }

  mousedown(event: any, d: any) {
    // because :active only works in WebKit?
    this.svg.classed('active', event.currentTarget);

    if (event.ctrlKey || this.mousedownNode || this.mousedownLink) return;

    // insert new node at point
    const point = d3.pointer(event);
    const node = { id: ++this.lastNodeId, reflexive: false, x: point[0], y: point[1] };
    this.nodes.push(node);

    this.restart();
  }

  mousemove(event: any, d: any) {
    if (!this.mousedownNode) return;
    // update drag line
    this.dragLine.attr('d', `M${this.mousedownNode.x},${this.mousedownNode.y}L${d3.pointer(event)[0]},${d3.pointer(event)[1]}`);
  }

  mouseup(event: any, d: any) {
    if (this.mousedownNode) {
      // hide drag line
      this.dragLine
        .classed('hidden', event.currentTarget)
        .style('marker-end', '');
    }

    // because :active only works in WebKit?
    this.svg.classed('active', false);

    // clear mouse event vars
    this.resetMouseVars();
  }

  spliceLinksForNode(node: any) {
    const toSplice = this.links.filter((l) => l.source === node || l.target === node);
    for (const l of toSplice) {
      this.links.splice(this.links.indexOf(l), 1);
    }
  }

  keydown(event: any, d: any) {
    event.preventDefault();

    if (this.lastKeyDown !== -1) return;
    this.lastKeyDown = event.keyCode;

    // ctrl
    if (event.keyCode === 17) {
      this.circle.call(this.drag);
      this.svg.classed('ctrl', event.currentTarget);
      return;
    }

    if (!this.selectedNode && !this.selectedLink) return;

    switch (event.keyCode) {
      case 8: // backspace
      case 46: // delete
        if (this.selectedNode) {
          this.nodes.splice(this.nodes.indexOf(this.selectedNode), 1);
          this.spliceLinksForNode(this.selectedNode);
        } else if (this.selectedLink) {
          this.links.splice(this.links.indexOf(this.selectedLink), 1);
        }
        this.selectedLink = null;
        this.selectedNode = null;
        this.restart();
        break;
      case 66: // B
        if (this.selectedLink) {
          // set link direction to both left and right
          this.selectedLink.left = true;
          this.selectedLink.right = true;
        }
        this.restart();
        break;
      case 76: // L
        if (this.selectedLink) {
          // set link direction to left only
          this.selectedLink.left = true;
          this.selectedLink.right = false;
        }
        this.restart();
        break;
      case 82: // R
        if (this.selectedNode) {
          // toggle node reflexivity
          this.selectedNode.reflexive = !this.selectedNode.reflexive;
        } else if (this.selectedLink) {
          // set link direction to right only
          this.selectedLink.left = false;
          this.selectedLink.right = true;
        }
        this.restart();
        break;
    }
  }

  keyup(event: any, d: any) {
    this.lastKeyDown = -1;

    // ctrl
    if (event.keyCode === 17) {
      this.circle.on('.drag', null);
      this.svg.classed('ctrl', false);
    }
  }

  render() {
    return (
      <div ref={this.svgRef}> </div>
    )
  }

}

export default App;