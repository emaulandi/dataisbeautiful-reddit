/*
Helpful ressources : 
https://bl.ocks.org/almsuarez/4333a12d2531d6c1f6f22b74f2c57102
http://bl.ocks.org/eyaler/10586116
http://bl.ocks.org/tlfrd/9d123cbd9e399e9450b25522eecdec38
*/

let width = 900,
    height = 900;

let svg = d3.select("#chart").append("svg")
		.attr("width", width)
		.attr("height", height)

/// TOOLTIP ///
// Add a div that will go wherever in the body 
let tooltip = d3.select("body").append("div")
	.attr("class", "tooltip")
	.style("opacity", 0);

const nodePadding = 10;
const birdColor = '#4fb783';
const seedColor = '#034561';
const lightLink = '#d9d9d9';
const richLink = '#b3b3b3';
const linkByIndex = {};
const birdDomain = [10,30];
const seedDomain = [10,70];
const nodeSizeDomain = [20,45];
const nodeStroke = 7;
const margin = 70;
const yScaleRange = [height - margin, margin];
let nodesImg = [];

var simulation = d3.forceSimulation();
var networkData ;

const weights = [1,3,5];

const weightScale = d3.scaleOrdinal()
	.domain(['Low','Medium','High'])
	.range(weights);

const nodesColorScale = d3.scaleOrdinal()
	.domain(['bird','seed'])
	.range([birdColor,seedColor]);

// change to threshold ?
const linksColorScale = d3.scaleOrdinal()
	.domain(weights)
	.range([lightLink,lightLink,richLink]);

const sizeBirds = d3.scaleSqrt().domain(birdDomain).range(nodeSizeDomain)
const sizeSeeds = d3.scaleSqrt().domain(seedDomain).range(nodeSizeDomain);

const ySizeBird = d3.scaleLinear().domain(birdDomain).range(yScaleRange);
const ySizeSeed = d3.scaleLinear().domain(seedDomain).range(yScaleRange);

const forcePropsCluster = {
	forceLink:{
		strength: 0
	},
	forceCharge:{
		strength: 0
	},
	forceX:{
		x: d => { if (d.type == 'bird') { return width/4 ; } else {return 3*width/4;} },
		//x: width/2,
		strength: 1
	},
	forceY: {
		y: d => yScaleNode(d),
		//y: height/2,
		strength: 1
	}
};
const forcePropsNewtork = {
	forceLink:{
		strength: 2.5
	},
	forceCharge:{
		strength: 0.5
	},
	forceX:{
		x: height / 2,
		strength: 0.8
	},
	forceY: {
		y: width / 2,
		strength: 0.8
	}
};

const forces = [
	{name: 'forcePropsCluster', force: forcePropsCluster},
	{name: 'forcePropsNewtork', force: forcePropsNewtork}
];

let forcesStatus = [false,true];
let opacityStatus = [0.3,1];
let btnStatus = ['Switch to network view', 'Switch to cluster view']

function toggleForce(){
	forcesStatus[0] = !forcesStatus[0];
	forcesStatus[1] = !forcesStatus[1];
}

function getLiveForce(){
	if(forcesStatus[0] == true){
		return forces[0].force
	}
	else{
		return forces[1].force
	}
}

d3.csv("data/node-img.csv", function(error, imgData) {
	console.log(imgData);
	nodesImg = imgData;
});

d3.csv("data/birds-seeds-network.csv", function(error, data) {

	networkData = generateNetworkData(data);
	console.log(networkData);
		
	generateLinksbyIndex(networkData.links);
	
	generateChartLayout();

	initializeSimulation();
	
	initDisplay();
	
});

/* ---------------------- */
/* DATA PREP & HANDLING */
/* ---------------------- */

function sizeNode(d){
	if(d.type == 'bird'){ return sizeBirds(d.size) }
	else { return sizeSeeds(d.size) }
}

function yScaleNode(d){
	if(d.type == 'bird'){ return ySizeBird(d.size) }
	else { return ySizeSeed(d.size) }
}

function generateNetworkData(data){
	
	data.forEach( (d,i) => {
			d.weight = weightScale(d.value);
	});
	console.log(data);
	
	// Compute list of birds and # of seeds they can eat
	let birdsNest = d3.nest()
  .key( d => { return d.source; })
	//.rollup( v => { return v.length; })
	.rollup( v => { 
		return d3.sum(v, item => { return item.weight; }) ;
	})
  .entries(data);
	//console.log(birdsNest);
	
	// Compute list of seeds and SUM preference of all birds that can eat them
	let seedsNest = d3.nest()
  .key( d => { return d.target; })
	.rollup( v => { 
		return d3.sum(v, item => { return item.weight; }) ;
	})
  .entries(data);
	//console.log(seedsNest);
	
	var nodes = [];
	
	//add birds nodes with bird color and size (# of seeds they can eat)
	birdsNest.forEach( d => {
		//console.log(d);
		nodes.push({
			name: d.key,
			size: d.value,
			type: 'bird'
		})
	})
	
	//add seeds nodes with seed color and size (SUM preference of all birds that can eat them)
	seedsNest.forEach( d => {
		//console.log(d);
		nodes.push({
			name: d.key,
			size: d.value,
			type: 'seed'
		})
	})
	
	//add image from image list
	nodes.forEach( d => {
		d.img = nodesImg[nodesImg.map(i => i.item).indexOf(d.name)].img;
	})
	
	//console.log(nodes);
	
	return {nodes: nodes, links: data};
}

function generateLinksbyIndex(links){
	links.forEach(d => {
    linkByIndex[`${d.source},${d.target}`] = 1;
  });
}

function isConnected(a, b) {
  return linkByIndex[`${a.name},${b.name}`] || linkByIndex[`${b.name},${a.name}`] || a.name === b.name;
}

/* ---------------------- */
/* DISPLAY */
/* ---------------------- */

function generateChartLayout() {
	
	svg.append("rect")
		.attr("height", height)
		.attr("width", width)
		.style("fill", '#f2f2f2')
		.attr("x", 0)
		.attr("y", 0)
		.attr("rx", 15)
		.attr("ry", 15);

	svg.append('g');
	
	setupBtn();
	
	const marginLegend = 30;
	const heightLegend = 180;
	
	let svgLegend = d3.select("#chartLegend").append("svg")
		.attr("width", width + 2*marginLegend)
		.attr("height", heightLegend + 2*marginLegend)
		.append("g")
		.attr("transform", "translate(" + marginLegend + "," + 2*marginLegend + ")");
		
	const legendColumns = [width/4, width*2/4, width*3/4];
	const itemNumbers = [2, 3, 3];
	const textPadding = 10;
	const legendLineLenght = 50;
	const birdSeedrings = [25,18];
	
	const circleLegend = [
		{fill: birdColor,  r : birdSeedrings[0], columnId : 0, itemNum : 1, text: 'Bird'},
		{fill: 'white', r : birdSeedrings[1], columnId : 0, itemNum : 1, text: ''},
		{fill: seedColor,  r : birdSeedrings[0], columnId : 0, itemNum : 2, text: 'Seed'},
		{fill: 'white',  r : birdSeedrings[1], columnId : 0, itemNum : 2, text: ''},
		{fill: '#bfbfbf',  r : 25, columnId : 1, itemNum : 1, text: 'Popular'},
		{fill: '#bfbfbf',  r : 17, columnId : 1, itemNum : 2, text: 'Normal'},
		{fill: '#bfbfbf',  r : 11, columnId : 1, itemNum : 3, text: 'Rare'},
	];
	
	const lineLegend = [
		{fill: 'white', stroke : 'grey', r : legendLineLenght, columnId : 2, itemNum : 1, weight: 5, text: 'High preference'},
		{fill: 'white', stroke : 'grey', r : legendLineLenght, columnId : 2, itemNum : 2, weight: 3, text: 'Medium preference'},
		{fill: 'white', stroke : 'grey', r : legendLineLenght, columnId : 2, itemNum : 3, weight: 1, text: 'Low preference'}
	];
	
	svgLegend.selectAll(".circleLegend")
    .data(circleLegend)
    .enter()
		.append("circle")
		.attr("class", "circleLegend")
		.attr("cx", d => width/3 * d.columnId)
		.attr("cy", d => heightLegend/itemNumbers[d.columnId] * (d.itemNum-1))
		.attr("r", d => d.r)
		.style("fill", d => d.fill);
	
	svgLegend.selectAll(".lineLegend")
    .data(lineLegend)
    .enter()
		.append("line")
		.attr("class", "lineLegend")
		.attr("x1",  d => width/3 * d.columnId)
		.attr("x2", d => width/3 * d.columnId + legendLineLenght)
		.attr("y1", d => heightLegend/itemNumbers[d.columnId] * (d.itemNum-1))
		.attr("y2", d => heightLegend/itemNumbers[d.columnId] * (d.itemNum-1))
		.attr("stroke-width", d => d.weight)
		.attr("stroke", d => linksColorScale(d.weight));
	
	svgLegend.selectAll(".textLegend")
    .data([...circleLegend, ...lineLegend])
    .enter()
		.append("text")
		.attr("class", "textLegend")
		.attr("x", d => width/3 * d.columnId + d.r + textPadding)
		.attr("y", d => heightLegend/itemNumbers[d.columnId] * (d.itemNum-1) + 5)
		.text(d => d.text)
}

function initDisplay(){
	
	// Create the link lines first, so that the circle are drawn on top
  svg.selectAll(".link")
    .data(networkData.links)
    .enter()
		.append("line")
		.style("stroke", d => linksColorScale(d.weight))
		.style("stroke-width", d => d.weight)
    .attr("class", "link");
	
	//Create nodes -> group
	let nodeGroup = svg.selectAll(".nodeGroup")
		.data(networkData.nodes)
		.enter()
		.append("g")
		.attr("class","nodeGroup")
		.on("mouseover", (d,i) => { 
			fade(d,0.05,0.05);
			showTip(d);
		})
		.on("mouseout", (d,i) => {
			fade(d,getOpacityState(),1);
			hideTip();
		})
		.call(d3.drag()
			.on("start", dragstarted)
			.on("drag", dragged)
			.on("end", dragended))
	
	// with circlePath corresponding to the nodes size
	var defs = nodeGroup
		.append("defs")
		.append('clipPath')
		.attr('id', (d,i) => `clip-circle${i}`)
		.append("circle")
			.attr("r", d => { return sizeNode(d)})
			.attr("cy", d => { return sizeNode(d)})
			.attr("cx", d => { return sizeNode(d)})
	
	// with backgroung circle
	nodeGroup
		.append("circle")
		.attr("r", d => { return sizeNode(d) + nodeStroke ;})
    .style("fill", d => nodesColorScale(d.type))
	
	// with rounded image
	nodeGroup
		.append("image")
		.attr("class","node")
		.attr("xlink:href",  (d) => { return d.img; })
		.attr("clip-path", (d,i) => `url(#clip-circle${i})`)
		.attr("height", d => { return sizeNode(d) * 2 ;})
		.attr("width", d => { return sizeNode(d) * 2 ;})
		.attr("transform","scale(2)")
		.attr("transform", (d) => { return "translate(" + (-sizeNode(d)) + "," + (-sizeNode(d)) +")"; });
	
	
}

function getOpacityState(){
	var opacity = 0;
	if (forcesStatus[0] == true){
		opacity = opacityStatus[0];
	}
	else {
		opacity = opacityStatus[1];
	}
	return opacity;
}

function toggleLinkOpacity(){
	
	d3.selectAll(".link")
    .style("stroke-opacity", getOpacityState());
}

function fade(d, opacityLink, opacityNode) {

	d3.selectAll(".link")
		.style('stroke-opacity', o => {
			//console.log(o);
			return (o.source === d || o.target === d ? getOpacityState() : opacityLink)
		});
	
	d3.selectAll(".nodeGroup")
		.style('opacity', o => {
			return (isConnected(d,o) ? 1 : opacityNode);
		});
}

/* ---------------------- */
/* FORCE FUNCTION */
/* ---------------------- */
function dist(d){
	//return Math.abs(6-d.weight) * 90;
	// Change to ordinal scale ?!
	switch(d.weight) {
    case 5:
        return 70;
        break;
    case 3:
        return 400;
        break;
		// for low (1)
    default:
        return 500;
	} 
}

function initializeSimulation(){
	simulation.nodes(networkData.nodes);
	
	initializeForce();
	
	simulation.force("link").links(networkData.links).distance(dist).strength(2.5);
	
	simulation.on("tick", updateNetwork);
}

function initializeForce(){
	simulation
		.force("link", d3.forceLink().id( d => { return d.name; }))
    .force("charge", d3.forceManyBody())
    .force("x", d3.forceX(width / 2).strength(0.8))
		.force("y", d3.forceY(height / 2).strength(0.8))
		.force("collision", d3.forceCollide( d => { return sizeNode(d) + nodeStroke + nodePadding}));
}

function updateForce(forceProps){
	
	simulation.force("link").strength(forceProps.forceLink.strength);
	
	simulation.force("charge").strength(forceProps.forceCharge.strength);
	
	simulation.force(
		"x", 
		d3.forceX(forceProps.forceX.x).strength(forceProps.forceX.strength)
	);
	
	simulation.force(
		"y",
		d3.forceY(forceProps.forceY.y).strength(forceProps.forceY.strength)
	);
	
	simulation.alpha(0.5).restart();
}

function updateNetwork(){
	/*
	d3.selectAll(".node")
		.attr("x", d => d.x)
		.attr("y", d => d.y)
	*/
	d3.selectAll(".nodeGroup").attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
	
	d3.selectAll(".link")
		.attr("x1", function(d) { return d.source.x; })
    .attr("y1", function(d) { return d.source.y; })
    .attr("x2", function(d) { return d.target.x; })
    .attr("y2", function(d) { return d.target.y; });
}

function dragstarted(d) {
  if (!d3.event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(d) {
  d.fx = d3.event.x;
  d.fy = d3.event.y;
}

function dragended(d) {
  if (!d3.event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}

/* ---------------------- */
/* TOOLTIP */
/* ---------------------- */
function showTip(d) {

	tooltip.html(printArticle(d))
		.style("left", (d3.event.pageX + 10) + "px")
		.style("top", (d3.event.pageY - 20) + "px");
		
	tooltip.transition()
   		.duration(500)
   		.style("opacity", .9);
}

function hideTip() {
	tooltip.transition()
		.duration(500)
		.style("opacity", 0);
}

function printArticle(v) {
	return "<h2 class='hXtooltip'>" + v.name + "</h2>"
		+ "<br/>" + "<b>" + v.size + " points</b>";
}

/* ---------------------- */
/* BUTTONS */
/* ---------------------- */
function getBtnStatus(){
	var text;
	if (forcesStatus[0] == true){
		text = btnStatus[0];
	}
	else {
		text = btnStatus[1];
	}
	return text;
}

function setupBtn() {
	// Switch force button
	d3.select("#btn-switch-force")
		.text(getBtnStatus())
		.on("click", () => {
			toggleForce();
		
			updateForce(getLiveForce());

			toggleLinkOpacity();	
		
			d3.select("#btn-switch-force").text(getBtnStatus());
		
			
	})
}




