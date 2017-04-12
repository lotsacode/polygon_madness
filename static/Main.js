/*  _____      _                         
   |  __ \    | |                        
   | |__) |__ | |_   _  __ _  ___  _ __  
   |  ___/ _ \| | | | |/ _` |/ _ \| '_ \ 
   | |  | (_) | | |_| | (_| | (_) | | | |
   |_|   \___/|_|\__, |\__, |\___/|_| |_|
                  __/ | __/ |            
                 |___/ |___/             
    __  __           _                     
   |  \/  |         | |                    
   | \  / | __ _  __| |_ __   ___  ___ ___ 
   | |\/| |/ _` |/ _` | '_ \ / _ \/ __/ __|
   | |  | | (_| | (_| | | | |  __/\__ \__ \
   |_|  |_|\__,_|\__,_|_| |_|\___||___/___/ 

    v1.0
*/

/* Globals */
var scene, camera, renderer, geometry, width, height, player, plane, mousePosX, mousePosY;
var spawns = [];
var pool = [];
var enemyMaxRadius = 100.0;
var coolDown = 200;
var T = 0;
var gameOver = false;
var explosion = new Audio("./static/explosion.wav");
var blop = new Audio("./static/blop.mp3");
var music = new Audio("./static/music.mp3");

/* Compatibility check */
var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
if (isMobile) alert("Warning: Mobile not supported. ");

function Player() {
    this.radius = 5;
	this.maxScaling = 10.0;
	this.scaleSpeed = 0.00;
	this.geometry = new THREE.Geometry(); 
    this.material = new THREE.MeshBasicMaterial({color: 0xFF0000, vertexColors: THREE.FaceColors});
    this.mesh = null;
	this.n = 64;
	this.theta = 2*Math.PI/32
	this.destroyed = false;
	this.geometry.vertices.push(new THREE.Vector3(0, 0, 0));
	this.sum = new THREE.Vector3(0,0,0);
	for (var n = 1; n <= this.n; n++) {
		var v = new THREE.Vector3(this.radius*Math.cos((n-1)*this.theta), this.radius*Math.sin((n-1)*this.theta), 0);
		this.geometry.vertices.push(v);
	}
	for (var n = 1; n <= this.n; n++) {
		if (n < this.n) {
			this.geometry.faces.push(new THREE.Face3( 0, n-1, n ));
		} else {
			this.geometry.faces.push(new THREE.Face3( 0, n-1, n));
			this.geometry.faces.push(new THREE.Face3( 0, n, 1));
		}
	}
	this.mesh = new THREE.Mesh(this.geometry, this.material);
	this.addToScene = function(x, y) {
		this.mesh.position.x = x; 
		this.mesh.position.y = y; 
		scene.add(this.mesh);
	}
	this.moveTowards = function(positionX, positionY) {
        if (this.destroyed || positionX == null || positionY == null) return;	
		var x = positionX - this.mesh.position.x;
		var y = positionY - this.mesh.position.y;
		var abs = x*x+y*y;
		this.mesh.position.x += 1.0*(x);
		this.mesh.position.y += 1.0*(y);
	};
	this.destroy = function() {
		var c = renderer.getClearColor(); 
	    c.g = 0;
	    c.b = 0;
		this.destroyed = true;
		gameOver = true;
		$("#end").delay(1000).fadeIn(1000);
		$("body").css("cursor", "default");
		explosion.play();
		music.pause();
	};
    this.bounded = function() {
        return ( this.mesh.position.x >= this.radius 
            && this.mesh.position.x <= width - this.radius 
            && this.mesh.position.y >= this.radius 
            && this.mesh.position.y <= height - this.radius
        );
    }
    this.collide = function(threshold, samples) {
		var edge = new THREE.Vector3(0,0,0);
		var ip = new THREE.Vector3(0,0,0);
		var test = new THREE.Vector3(0,0,0);
		var colliders = spawns.concat(pool);
		for (var i = 0; i < colliders.length; i++) {
			test.set(geometry.vertices[colliders[i].index].x, geometry.vertices[colliders[i].index].y, 0)
			test.sub(this.mesh.position)
			if (test.lengthSq() >= 500+(colliders[i].radius + this.radius)*(colliders[i].radius + this.radius)) continue;
			for (var j = 1; j <= colliders[i].sides; j++) {
				var index = colliders[i].index + j;
				if (j == colliders[i].sides) { // Last edge
					edge.x = geometry.vertices[colliders[i].index+1].x - geometry.vertices[index].x; 
					edge.y = geometry.vertices[colliders[i].index+1].y - geometry.vertices[index].y;  
				} else {
					edge.x = geometry.vertices[index+1].x - geometry.vertices[index].x; 
					edge.y = geometry.vertices[index+1].y - geometry.vertices[index].y;  
				}
				edge.multiplyScalar(1 / (1+samples))
				ip.set(geometry.vertices[index].x, geometry.vertices[index].y, 0)
				test.set(0,0,0);
				test.add(ip);
				test.sub(this.mesh.position);
				if (test.lengthSq() < (this.radius + threshold)*(this.radius + threshold)) return true;
				for (var k = 0; k < samples; k++) {
					ip.add(edge)
					test.set(0,0,0);
					test.add(ip);
					test.sub(this.mesh.position);
					if (test.lengthSq() < (this.radius + threshold)*(this.radius + threshold)) return true;
				}
			}
		}
		return false;
	}
	this.update = function() {
		if (this.destroyed) return;
		if (this.mesh.scale.x < this.maxScaling) {
			this.mesh.scale.x += this.scaleSpeed;
			this.mesh.scale.y += this.scaleSpeed;
		};
		this.moveTowards(mousePosX, mousePosY);
		if(this.collide(0, 10)) {
			this.destroy();
		}
	}
}


function Enemy(radius, sides, direction, speed, root, phase) {
	this.geometry = new THREE.Geometry();
	this.radius = radius;
	this.sides = sides; 
	this.direction = direction;
	this.theta = 2*Math.PI/this.sides;
	this.rnd = Math.random();
	this.speed = speed;
	this.index = null;
	this.length = this.sides + 1;
	this.lifeSpan = 170;
	this.root = root;
	this.T = this.lifeSpan;
	this.decayPow = 2;
	this.children = [];
	this.phase = phase;
	this.x = 0;
	this.y = 0;
	this.geometry = new THREE.Geometry(); 
	this.geometry.vertices.push(new THREE.Vector3(0, 0, 0));
	for (var n = 1; n <= this.sides; n++) {
		var v = new THREE.Vector3(this.radius*Math.cos((n-1)*this.theta + this.phase), this.radius*Math.sin((n-1)*this.theta + this.phase), 0);
		this.geometry.vertices.push(v);
	}
	for (var n = 1; n <= this.sides; n++) {
		if (n < this.sides) {
			this.geometry.faces.push(new THREE.Face3( 0, n-1, n ));
		} else {
			this.geometry.faces.push(new THREE.Face3( 0, n-1, n));
			this.geometry.faces.push(new THREE.Face3( 0, n, 1));
		}
	}
	var material = new THREE.MeshBasicMaterial({
		color: 0xff0000, 
		side: THREE.DoubleSide
	});
	this.mesh = new THREE.Mesh(this.geometry, material);
	this.mesh.position.x = -123123;
	this.mesh.position.y = -123123;
	scene.add(this.mesh);
	this.addToGeometry = function() {
		this.index = geometry.vertices.length;
		geometry.mergeMesh(this.mesh);
	}
	this.spawn = function() {
		if (this.root) {
			this.direction = Math.atan2(player.mesh.position.y - this.y, player.mesh.position.x - this.x);
		}
		spawns.push(this);
		for (var i = 0; i < this.length; i++) {
			var index = this.index + i;
		}
		return this;
	}
	this.setColor = function(hue) {
		for (var i = 0; i < this.sides+1; i++) {
			geometry.faces[this.index + i].color = new THREE.Color().setHSL(hue, 1.0, 0.6);
		}
	}
	this.bounded = function() {
		var origin = geometry.vertices[this.index];
        return ( origin.x >= this.radius 
            && origin.x <= width - this.radius 
            && origin.y >= this.radius 
            && origin.y <= height - this.radius
        );
    }
    this.depth = function() {
    	var d = 0;
    	var e = this;
    	while (e.children.length != 0) {
    		e = e.children[0];
    		d += 1;
    	}
    	return d;
    }
    this.moveTo = function(x, y) {
    	this.x = x;
    	this.y = y;
    	for (var i = 0; i < this.length; i++) {
			var index = this.index + i;
			if (i == 0) {
				geometry.vertices[index].x = x;
				geometry.vertices[index].y = y;
			} else {
				geometry.vertices[index].x = x + this.radius*Math.cos(i*this.theta + this.phase);
				geometry.vertices[index].y = y + this.radius*Math.sin(i*this.theta + this.phase);
			}
		}
    }
    var s = this.speed;
	this.move = function() {
		dx = s * Math.cos(this.direction);
		dy = s * Math.sin(this.direction);
		var avg = new THREE.Vector3(0,0,0);
		for (var i = 0; i < this.length; i++) {
			var index = this.index + i;
			avg.add(geometry.vertices[index]);
		}
		avg.multiplyScalar(1/(1.0*this.length));
		for (var i = 0; i < this.length; i++) {
			var index = this.index + i;
			geometry.vertices[index].x += dx;
			geometry.vertices[index].y += dy;
		}
		this.x += dx;
		this.y += dy;
		var t = this.lifeSpan - this.T;
		if (this.children.length != 0) {
			if (s > 0) {
				s = this.speed*(1-Math.pow(t/this.lifeSpan, this.decayPow));
			} else {
				s = 0;
			}
		} else { // No children, linear speed and live until unbounded
			s = this.speed;
			this.T = this.lifeSpan;
		}
		if (!this.bounded() && this.children.length == 0) {
			this.destroy()
		}
	};
	this.destroy = function() {
		for (var i = 0; i < this.length; i++) {
			var index = this.index + i;
			geometry.vertices[index].x = -123123
			geometry.vertices[index].y = -123123
		}
		this.destroyed = true;
		spawns.splice(spawns.indexOf(this), 1);
	};
	this.explode = function() {
		blop.currentTime = 0;
		blop.play();
		for (var i = 0; i < this.children.length; i++) {
			this.children[i].direction = (i)*this.theta;
			this.children[i].phase = (i)*this.theta;
			this.children[i].moveTo(
				geometry.vertices[this.index].x,
				geometry.vertices[this.index].y
			);
			
			this.children[i].spawn();
		}
		this.destroy();
	}
	this.update = function() {
		this.move();
		this.T -= 1;
		if (this.T <= -10 && !this.destroyed) this.explode();
	}
}

/* Init */
function init() {
    document.addEventListener('mousemove', onMouseMove, true);
	window.addEventListener( 'resize', onWindowResize, false );
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 1, 100000);
	renderer = new THREE.WebGLRenderer();
	renderer.setClearColor(0xf0ffff);
	geometry = new THREE.Geometry();
	geometry.dynamic = true;
    width = window.innerWidth;
    height = window.innerHeight;
    renderer.setSize(width, height);
    $("#three").append(renderer.domElement);
    camera.position.x = width / 2;        
    camera.position.y = height / 2;    
    camera.position.z = height / ( 2 * Math.tan( camera.fov * Math.PI / 360 ));       
    var planeGeometry = new THREE.PlaneGeometry(width, height); 
    plane = new THREE.Mesh(planeGeometry, new THREE.MeshBasicMaterial({color: 0x002200}));
    plane.position.x = width/2;
    plane.position.y = height/2;
    player = new Player();
    player.addToScene(width/2,height/2);
    explosion.loop = false;
    explosion.volume = 0.15;
    blop.loop = false;
    blop.volume = 0.2;
    music.loop = true;
    music.volume = 0.2
    /* 
    	Initialize geometry 
	*/
    for (var s = 1; s < 21; s++) {
    	var posx, posy;
    	var offset = 10;
    	var rnd = Math.random()
        if (rnd < 0.25) { // right
            posx = width + offset;
            posy = Math.random()*height;
        } else if (rnd < 0.5) { // up
            posx = Math.random()*width;
            posy = height + offset;
        } else if (rnd < 0.75) { // left
            posx = 0 - offset;
            posy = Math.random()*height;
        } else { // down
            posx = Math.random()*width;
            posy = 0 - offset;
        }
        var phase = 0*Math.PI*Math.random();
		var sides = Math.floor(3+Math.random()*5)
		var bigEnemy = new Enemy((1.0+1.0*Math.random())*enemyMaxRadius*Math.sqrt(width*height)/1600, sides, Math.atan2(200 - posy, 200 - posx), 
			8.0*(0.8+0.2*Math.random())*Math.sqrt(width*height)/1200, true, phase);
		bigEnemy.addToGeometry();
		bigEnemy.setColor(0.1*s/8);
		bigEnemy.moveTo(posx, posy);
		pool.push(bigEnemy);
		var bigEnemyChildren = [];
		for (var i = 0; i < sides; i++) {
			var mediumEnemy = new Enemy(1.5*bigEnemy.radius/4, sides, bigEnemy.direction + i*bigEnemy.theta, bigEnemy.speed*0.66, false, phase);
			mediumEnemy.addToGeometry();
			mediumEnemy.setColor(0.2*s/8);
			bigEnemyChildren.push(mediumEnemy);
			var mediumEnemyChildren = [];
			for (var j = 0; j < sides; j++) {
				var smallEnemy = new Enemy(2*mediumEnemy.radius/4, sides, mediumEnemy.direction + j*mediumEnemy.theta, mediumEnemy.speed*0.66, false, phase);
				smallEnemy.addToGeometry();
				smallEnemy.setColor(0.3*s/8);
				mediumEnemyChildren.push(smallEnemy);
				var smallEnemyChildren = [];
				for (var k = 0; k < sides; k++) {
					var verySmallEnemy = new Enemy(2.0*smallEnemy.radius/4, sides, smallEnemy.direction + k*smallEnemy.theta,smallEnemy.speed*0.66, false, phase);
					verySmallEnemy.addToGeometry();
					verySmallEnemy.setColor(0.4*s/8);
					smallEnemyChildren.push(verySmallEnemy);
				}
				smallEnemy.children = smallEnemyChildren;
			}
			mediumEnemy.children = mediumEnemyChildren;
		}
		bigEnemy.children = bigEnemyChildren;
    }
	var material = new THREE.MeshBasicMaterial({
		color: 0xffffff, 
		vertexColors: THREE.FaceColors,
	});
    /* Add geometry to scene */
    var mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
}

function draw() {
	renderer.render(scene, camera);
}

function render() {
	requestAnimationFrame(render);
    renderer.render(scene, camera);
    var c = renderer.getClearColor(); 
    if (c.g < 1.0) c.g += 0.01;
    if (c.b < 1.0) c.b += 0.01;
    if (gameOver) return;
    if (T % coolDown == 0 && pool.length != 0) { // Spawn enemy
    	var enemy = pool.pop();
    	enemy.spawn();
    	if (coolDown > 0) coolDown -= 5;
    }
    spawns.forEach(function(spawn) {
    	spawn.update();
    });
    player.update();
    geometry.verticesNeedUpdate = true;
    $(".seconds").text((T/60).toFixed(1));
    T += 1;
    if (!player.destroyed && spawns.length == 0) {
    	alert("AMAZING! YOU WIN!");
    	$("#end-text").text("You survived until the end!");
    	$("body").css("cursor", "default");
    	$("#end").fadeIn(1000);
    	gameOver = true;
    }
}
/* Events */
function onMouseMove(e) {
    var vector = new THREE.Vector3();
    vector.set(
        ( e.clientX /window.innerWidth ) * 2 - 1,
        - ( e.clientY / window.innerHeight ) * 2 + 1,
        0.5 );
    vector.unproject(camera);
    var dir = vector.sub(camera.position).normalize();
    var distance = - camera.position.z / dir.z;
    var pos = camera.position.clone().add( dir.multiplyScalar(distance));
    if (pos == null) return;
    mousePosX = pos.x;
    mousePosY = pos.y;
    vector = null;
    dir = null;
    distance = null;
    pos = null;
}

function onWindowResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
    width = window.innerWidth;
    height = window.innerHeight;
}

$(document).ready(function() {
    init();
    draw();
    $("#play").click(function(){
    	music.play();
        $("#time").fadeIn(1000);
        $("#start").fadeOut(1000);
        $("body").css("cursor", "none");
        render();
        $("#play").hide();
    });
    $("#replay").click(function(){
        window.location.reload(false);
    });
});


