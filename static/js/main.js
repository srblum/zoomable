$(function(){
  d3.csv('input.csv',function(data){

    var query,
        xMid = 0,
        yMid = 0;

    zoomToWord = function(query){
      for(var i =0; i < data.length; i++){
        if(data[i].label === query){
          var x = +data[i]['x'],
              y = +data[i]['y'],
              z = d3.zoomIdentity.translate(width/2,height/2).scale(80).translate(-xScale(x),-yScale(y));

          canvas.transition()
              .duration(1500)
              .call(zoom.transform, z);
        }
      }
    }

    $("#search-button").on("click",function(){
      query = $("#search-input").val();
      zoomToWord(query);
    });
    $("#search-input").on("keypress",function(e){
      if(e.key === "Enter"){
        query = $("#search-input").val();
        zoomToWord(query);
      }
    })

    $("#im-feeling-lucky").on("click",function(){
      query = data[Math.random() * data.length | 0]['label'];
      zoomToWord(query);
    });

    //Slider code
    var sliderToScale = d3.scalePow().domain([1,10000]).range([1,200]).exponent(2);
    $( "#slider-vertical" ).slider({
      orientation: "vertical",
      range: "min",
      min: 1,
      max: 10000,
      value: 1,
      slide: function( event, ui ) {
        k = sliderToScale(ui.value);
        canvas.call(zoom.transform, d3.zoomIdentity.translate(width/2,height/2).scale(k).translate(-xScale(xMid),-yScale(yMid)))
      }
    });

    // define all size variables
    var fullWidth = 1200;
    var fullHeight = 700;
    var margin = {top: 0, right: 0, bottom: 30, left: 25};
    var width = fullWidth - margin.left - margin.right;
    var height = fullHeight - margin.top - margin.bottom;

    zoom = d3.zoom()
        .scaleExtent([1, Infinity])
        .on("zoom", zoomed);

    // the canvas is shifted by 1px to prevent any artifacts
    // when the svg axis and the canvas overlap
    var canvas = d3.select("#plot-canvas")
        .call(zoom)
        .attr("width",width-1)
        .attr("height",height-1)
        .style("transform", "translate(" + (margin.left + 1) +
            "px" + "," + (margin.top + 1) + "px" + ")"),
        ctx = canvas.node().getContext("2d");

    var svg = d3.select("#axis-svg")
        .attr("width", fullWidth)
        .attr("height", fullHeight)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," +
            margin.top + ")");

    // ranges, scales, axis, objects
    var xRange = d3.extent(data, function(d) { return +d.x });
    var yRange = d3.extent(data, function(d) { return +d.y });

    var xScale = d3.scaleLinear()
        .domain(xRange)
        .range([0, width]);

    var yScale = d3.scaleLinear()
        .domain(yRange)
        .range([height, 0]);

    var xAxis = d3.axisBottom(xScale)
        .tickSize(5)
        .tickPadding(6);

    var yAxis = d3.axisLeft(yScale)
        .tickSize(5)
        .tickPadding(6);

    var gX = svg.append("g")
     .attr("class", "axis axis--x")
     .attr("transform", "translate(0," + height + ")")
     .call(xAxis);

    var gY = svg.append("g")
     .attr("class", "axis axis--y")
     .call(yAxis);

    var bins = 25;
    var sBins = 25;

    //CREATE EMPTY 3D ARRAYS THAT REPRESENT (SPARSITY, X, Y) GRID CELLS
    var sGrids = [];

    for(var s = 0; s < sBins; s++){
      sGrids.push([]);
      for(var i = 0; i < bins; i++){
        sGrids[s].push([]);
        for(var j = 0; j<bins; j++){
          sGrids[s][i].push([]);
        }
      }
    }

    //CREATE SCALE OBJECT TO CONVERT K TO APPROPRIATE SPARSITY BIN
    kToSbin = d3.scaleLinear().domain([1,10]).rangeRound([0,sBins-1]);

    //SPLIT THE DATA INTO X AND Y BINS
    binX = d3.scaleLinear().domain(xRange).rangeRound([0,bins-1]);
    binY = d3.scaleLinear().domain(yRange).rangeRound([0,bins-1]);

    //CREATE A 2D GRID FOR THE SOLE PURPOSE OF DETERMINING THE MAXIMUM DATA PER CELL (maxCell)
    var grid = [];
    for(var i = 0; i < bins; i++){
      grid.push([]);
      for(var j = 0; j<bins; j++){
        grid[i].push([]);
      }
    }
    data.forEach(function(d){
      var x = binX(d.x),
          y = binY(d.y);
      grid[x][y].push(d)
    })
    var maxDensity = 0;
    for(var i = 0; i < bins; i++){
      for(var j = 0; j < bins; j++){
        var l = grid[i][j].length;
        if(l > maxDensity){
          maxDensity = l;
        }
      }
    }

    //MAP FROM (0 to sBin) to (baselineDensity to maxDensity)
    var baselineDensity = Math.round(maxDensity/8);
    var sBinToDensity = d3.scalePow().domain([0,sBins-1]).range([baselineDensity,maxDensity]).exponent(1)

    //SORT THE DATA INTO BINS
    for(var s = 0; s < sBins ; s++){
      var limit = sBinToDensity(s);
      for(var i = 0; i < data.length; i++){
        var d = data[i],
            x = binX(d.x),
            y = binY(d.y);

        var cell = sGrids[s][x][y];
        if(cell.length < limit){
          cell.push(d);
        }else{
          break;
        }
      }
    }

    var kToFontSize = d3.scaleLog().domain([1,80]).rangeRound([6,35]).base(3);
    var redScale = d3.scaleLinear().domain([0,1]).rangeRound([40,240]);
    var blueScale = d3.scaleLinear().domain([0,1]).rangeRound([180,80]);
    var greenScale = d3.scaleLinear().domain([0,1]).rangeRound([40,10]);
    var alphaScale = d3.scaleLinear().domain([0,1]).range([0.35,0.8]);

    draw(d3.zoomIdentity);

    function zoomed() {
      draw(d3.event.transform);
    }

    function draw(transform) {
      var i = -1,
          dx = transform.x,
          dy = transform.y
          k = transform.k;

      var x0 = binX(xScale.invert(-dx/k)),
          x1 = binX(xScale.invert((width-dx)/k)),
          y0 = binY(yScale.invert((height-dy)/k)),
          y1 = binY(yScale.invert(-dy/k));

      $("#slider-vertical").slider("value",sliderToScale.invert(k) | 0);
      $("#zoom-level").text(k | 0)

      ctx.clearRect(0, 0, width, height);

      xMid = xScale.invert((width/2-dx)/k);
      yMid = yScale.invert((height/2-dy)/k);

      var new_xScale = transform.rescaleX(xScale);
      var new_yScale = transform.rescaleY(yScale);

      // update axes
      gX.call(xAxis.scale(new_xScale));
      gY.call(yAxis.scale(new_yScale));

      x0 = x0 < 0 ? 0 : x0;
      x1 = x1 >= bins ? bins-1 : x1;
      y0 = y0 < 0 ? 0 : y0;
      y1 = y1 >= bins ? bins-1 : y1;

      ctx.font = kToFontSize(k)+"px Open Sans";
      ctx.beginPath();

      var s = kToSbin(k);
      s = s >= sBins ? sBins -1 : s;

      //ITERATE THROUGH ONLY IN-BOUND INDICES
      for(var i = x0; i <= x1 ; i++){
        for(var j = y0; j <= y1; j++){
          var grid = sGrids[s][i][j];
          for(var k = 0; k < grid.length; k++){
            var x = xScale(grid[k]['x']),
                y = yScale(grid[k]['y']),
                label = grid[k]['label'],
                color = +grid[k]['color'];

            ctx.fillStyle = `rgba(${redScale(color)},${greenScale(color)},${blueScale(color)},${alphaScale(color)})`;

            var d = transform.apply([x,y]);
            ctx.fillText(label,d[0],d[1]);
          }
        }
      }
      ctx.fill();
    }
  });
})