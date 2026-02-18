const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const grid = 20;
let snake = [{x: 9*grid, y: 9*grid}];
let dx = grid;
let dy = 0;
let food = randomFood();
let score = 0;

function randomFood() {
    return {
        x: Math.floor(Math.random() * 30) * grid,
        y: Math.floor(Math.random() * 30) * grid
    };
}

function collision(head, array) {
    for(let i=0; i<array.length; i++){
        if(head.x === array[i].x && head.y === array[i].y){
            return true;
        }
    }
    return false;
}

document.addEventListener("keydown", function(e){
    if(e.key === "ArrowUp" && dy === 0){ dx = 0; dy = -grid; }
    else if(e.key === "ArrowDown" && dy === 0){ dx = 0; dy = grid; }
    else if(e.key === "ArrowLeft" && dx === 0){ dx = -grid; dy = 0; }
    else if(e.key === "ArrowRight" && dx === 0){ dx = grid; dy = 0; }
});

function gameLoop(){
    ctx.clearRect(0,0,canvas.width, canvas.height);

    ctx.fillStyle = "red";
    ctx.fillRect(food.x, food.y, grid, grid);

    let head = {x: snake[0].x + dx, y: snake[0].y + dy};

    if(head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height || collision(head, snake)){
        alert("Game Over! Puntaje: " + score);
        snake = [{x: 9*grid, y: 9*grid}];
        dx = grid; dy = 0;
        score = 0;
        food = randomFood();
        document.getElementById("score").innerText = "Puntaje: 0";
        return;
    }

    snake.unshift(head);

    if(head.x === food.x && head.y === food.y){
        score += 1;
        food = randomFood();
        document.getElementById("score").innerText = "Puntaje: " + score;
    } else {
        snake.pop();
    }

    ctx.fillStyle = "#00ff00";
    for(let i=0;i<snake.length;i++){
        ctx.fillRect(snake[i].x, snake[i].y, grid, grid);
    }

    setTimeout(gameLoop, 100);
}

gameLoop();
