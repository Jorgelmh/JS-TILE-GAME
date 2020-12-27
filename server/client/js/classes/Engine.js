import character from '../character.js'

/**
 * ============================
 *         ENGINE CLASS
 * ============================
 */

export default class Engine{

    constructor(map, collisionMatrix, shadowMatrix, tileset, canvas, skin){

        /* General variables */
        this.canvas = canvas
        this.context  = this.canvas.getContext("2d")
        
        /* List with single tiles -> no-repeated img -> Use to load only one image for each value */
        this.tileList = []

        /* Array that stores -> id = in the map matrix AND img = Image object */
        this.tileImages = []
        this.localGame = null
        this.skin = skin

        /* Total amount of ammo for the character selected */
        this.playerAmmunition = null
        this.currentAmmo = null
        this.reloading = false
        this.shootingDelay = null
        this.ableToShoot = true

        /* Html <p> that shows the amount of bullets in the charger */
        this.bulletsHTMLElement = document.getElementById('charger')

        this.character = character

        /* Tile properties */
        this.tile = {
            width: null,
            height: null
        }

        /*  TileMap Object -> properties and tiles  */

        this.tileMap = {

            tileSet: tileset,
            tiles: map,
            startX: 200,
            startY: 200,
            width: 1280,
            height: 720
        }

        /* Tiles per screen */
        this.screenTiles= {
            x: 16,
            y: 9
        }

        this.frameDefaultDimensions = {
            width: 1280,
            height: 720
        }

        /* Player stats */

        this.playerStats = null

        /* Calculate the average ratio of the screen */
        this.frameRatio= this.frameDefaultDimensions.height / this.frameDefaultDimensions.width

        this.offSet={
            x: null,
            y: null,
            xLimit: null,
            yLimit: null
        }

        /* Relative position of player */

        this.playerRelativePosition = null

        /* FPS Counter */

        this.lastFrameTime = 0
        this.FPS = 0

        /* Static Animation */
        this.staticAnimation = {
            interval : null,
            x: 0
        }

        /* Collisionable */
        this.collisionMatrix = collisionMatrix

        /* Shadow matrix */
        this.shadowMatrix = shadowMatrix

        this.shooting = false

        /* Animation? */
        this.animatedSprites = false

        /* Camera smoothness */
        this.cartesianValueOfMovement = {
            x: 0,
            y: 0,
        }

        this.cameraSmoothness = {
            velX: .5,
            velY: 2,
            friction: .98,
            offsetX: 0,
            offsetY: 0,
        }
 
        /* Bullets Image */
        this.bulletSprite = {
            width: null,
            height: null,
            img: null
        }

        /* Get the timings of the animation 0-4 */
        this.animationTiming = 1
        
        window.addEventListener('resize', this.resizeCanvas)
        this.resizeCanvas()
        this.load()
    }

    /* 
        =================
            LOAD TILES
        =================
    */

    load(){

        console.log(this.tileList)
        console.log(this.tileImages)
        console.log(this.tileMap.tiles)
        console.log(this.collisionMatrix)
        console.log(this.shadowMatrix);

        const pushImg = (val) => {

            if(Array.isArray(val)){
                val.forEach((value) => pushImg(value))
                this.animatedSprites = true

            }else{
                if(val !== 0 && this.tileList.indexOf(val) < 0)
                    this.tileList.push(val)
            }
        }

        /* Retrieve single tile values */
        for(let i = 0; i < this.tileMap.tiles.length; i++){
            for(let j = 0; j < this.tileMap.tiles[0].length; j++){
                pushImg(this.tileMap.tiles[i][j])
                pushImg(this.collisionMatrix[i][j])
                pushImg(this.shadowMatrix)
            }
        }


        let loadedImages = 0 // Check if all images have been loaded
        for(let i = 0; i < this.tileList.length; i++){

            let tileImage = new Image()
            tileImage.onload = () => {
                if(++loadedImages >= this.tileList.length){
                    this.bulletSprite.img = new Image()
                    this.bulletSprite.img.onload = () => {
                        this.loadCharacter()
                    }
                    this.bulletSprite.img.src = '../assets/resources/bullets.png'
                }
            }

            tileImage.src = `../assets/tiles/${this.tileMap.tileSet}/tile_00${(this.tileList[i]<10) ? '0'+this.tileList[i]: this.tileList[i]}.png`

            this.tileImages.push({
                id: this.tileList[i],
                img: tileImage
            })
        }
    }

    loadCharacter(){
        this.character.load(`${this.skin}.png`, () => {
            if(this.animatedSprites)
                this.setAnimationTiming()

            requestAnimationFrame(this.render)
        })
    }

    /* Auto resize the canvas when the screen is resized */

    resizeCanvas = () =>{
        //let self = engine
        let tempWidth = this.tileMap.width, tempHeight = this.tileMap.height

        /* Dimension of the general canvas */
        this.canvas.width = window.innerWidth

        /* Tile width and height responsive */
        this.tile.width = this.canvas.width/ this.screenTiles.x
        this.tile.height = this.canvas.width * this.frameRatio / this.screenTiles.y

        /* Dimensions of the tile map */
        this.tileMap.width = this.tileMap.tiles[0].length * this.tile.width
        this.tileMap.height = this.tileMap.tiles.length * this.tile.height

        this.canvas.height = (this.canvas.width * this.frameRatio < window.innerHeight) ? this.canvas.width * this.frameRatio : window.innerHeight

        /* Start points responsive -> rule of 3*/
        this.tileMap.startX = (this.tileMap.startX * this.tileMap.width) / tempWidth
        this.tileMap.startY = (this.tileMap.startY * this.tileMap.height) / tempHeight

        /* Camera smoothness ratio */
        this.cameraSmoothness.limitX = this.canvas.width * .045
        this.cameraSmoothness.limitY = this.canvas.height * .045

        /* Bullet's size */
        this.bulletSprite.width = this.canvas.width * .02
        this.bulletSprite.height = this.canvas.width * .02

        /* Set player's position */
        this.playerRelativePosition = this.getPlayerRelativePosition()

    }

    /**
     * =================================
     *  GENERAL FUNCTIONS FOR RENDERING
     * =================================
     */

    /* Calculate which tiles are to be drawn within the screen */
    calculateOffset(){
        this.offSet.x = (this.tileMap.startX < 0) ? Math.floor((-this.tileMap.startX) / this.tile.width) : 0
        this.offSet.y = (this.tileMap.startY < 0) ? Math.floor((-this.tileMap.startY) / this.tile.height) : 0

        let offsetX =  this.screenTiles.x + Math.floor((-this.tileMap.startX) / this.tile.width)+1
        let offsetY = this.screenTiles.y + Math.floor((-this.tileMap.startY) / this.tile.height)+1

        this.offSet.xLimit = (offsetX > this.tileMap.tiles[0].length) ? this.tileMap.tiles[0].length: offsetX
        this.offSet.yLimit = (offsetY > this.tileMap.tiles.length) ? this.tileMap.tiles.length:offsetY
    }

    /* Draw Map function */
    drawMap(){

        for(let i =  this.offSet.y; i < this.offSet.yLimit; i++){
            for(let j = this.offSet.x; j < this.offSet.xLimit; j++)
                this.drawTile(j, i, this.tileMap.tiles)
        }
    }

    drawShadows(){
        for(let i =  this.offSet.y; i < this.offSet.yLimit; i++){
            for(let j = this.offSet.x; j < this.offSet.xLimit; j++)
                if(this.shadowMatrix[i][j])
                    this.drawTile(j, i, this.shadowMatrix)
        }
    }

    /* Draw objects from collision matrix */
    drawObjects(){
        for(let i =  this.offSet.y; i < this.offSet.yLimit; i++){
            for(let j = this.offSet.x; j < this.offSet.xLimit; j++){
                if(this.collisionMatrix[i][j])
                    this.drawTile(j, i, this.collisionMatrix)
                
            }   
        }
    }

    /* Draw single tile on canvas */
    drawTile(xi, yi, matrix){

        let indexImage = (Array.isArray(matrix[yi][xi])) ? this.tileImages.findIndex((elem) => elem.id === matrix[yi][xi][this.animationTiming]) : this.tileImages.findIndex((elem) => elem.id === matrix[yi][xi])
          
        if(matrix[yi][xi] !== 0)
            this.context.drawImage(this.tileImages[indexImage].img, xi * (this.tile.width) + this.tileMap.startX, yi * (this.tile.height) + this.tileMap.startY, this.tile.width, this.tile.height)
    }

    drawCharacter(){

        let spriteSheetPos = (this.playerStats.life === 0 ) ? {x: 1, y: 8} : this.character.currentSprite

        this.context.drawImage(this.character.spriteSheet.img, spriteSheetPos.x * this.character.spriteSheet.width, spriteSheetPos.y * this.character.spriteSheet.height
                                , this.character.spriteSheet.width, this.character.spriteSheet.height, this.playerRelativePosition.posX, this.playerRelativePosition.posY, this.tile.width, this.tile.height)
    }

    /* In case of animated tile -> set the timing for every tile */
    setAnimationTiming(){
        setInterval(() => {
            if(this.animationTiming === 4)
                this.animationTiming = 0
            else
                this.animationTiming ++
        }, 350)
    }


    /**
     *  =======================================
     *    FUNCTIONS TO CALCULATE POSITIONS
     *  =======================================
     */

    getPlayerPosition(){
        let posX = Math.floor(((this.tileMap.width / 2) - this.tileMap.startX) / this.tile.width)
        let posY = Math.floor(((this.tileMap.height / 2) - this.tileMap.startY) / this.tile.height)
        //console.log(`${posX}, ${posY}`)

        return {posX, posY}
    }

    /* Get player realtive position to the screen size */
    getPlayerRelativePosition(){
        let posX = this.screenTiles.x * this.tile.width/2 - (this.tile.width/2)
        let posY = this.screenTiles.y * this.tile.height/2 - (this.tile.height/2)

        return {posX, posY}
    }

    /* returns position of a given position in the matrix relative to the screen */
    getTilesRelativePosition(x, y){
        let posX = x*this.tile.width + this.tileMap.startX
        let posY = y*this.tile.height + this.tileMap.startY

        return {posX, posY}
    }

    /* Set animation when static */

    setAnimationWhenStatic(){
        this.staticAnimation.interval = setInterval(() =>{
            this.staticAnimation.x ++

            if(this.staticAnimation.x === 3) 
                this.staticAnimation.x = 0

        }, this.character.animationSpeed)
    }

    endAnimationWhenStatic(){
        clearInterval(this.staticAnimation.interval)
        this.staticAnimation.interval = null
    }

    /* Draw life of an entity */
    drawLife(posX, posY, life){

        this.context.beginPath()

        this.context.rect(posX, posY, this.tile.width, this.tile.height/10)
        this.context.stroke()

        this.context.beginPath()

        this.context.rect(posX, posY, this.tile.width*life/100, this.tile.height/10)
        this.context.fillStyle = 'red'
        this.context.fill()

        this.context.closePath()

        this.context.restore()
    }

    /** 
     *  =========================
     *      SHOOTING MECHANICS
     *  =========================
    */

    /* Shooting timing */
    triggerShooting  = (dir, spriteY) => {

        // Testing variables for shooting
        console.log(`able to shoot: ${this.ableToShoot} ; controls shoot: ${this.controls.shoot} ; chat inactive: ${this.chat.active} ; ammo : ${this.currentAmmo} ; reloading: ${this.reloading}`)
        
        if(this.ableToShoot && this.controls.shoot && !this.chat.active && this.currentAmmo && !this.reloading){
            this.ableToShoot = false

            setTimeout(() => {
                this.ableToShoot = true
            }, this.shootingDelay)
    
            /* Fire animation */
            setTimeout(() => {
                this.emitBullet(dir, spriteY)
    
                if(this.playerStats.life > 0)
                    this.character.spriteSheet.img =  this.character.spriteImages.shooting
                
                setTimeout(() => {
                    this.character.spriteSheet.img = this.character.spriteImages.normal
                }, 90)
    
            }, 70)
        }
    }
}