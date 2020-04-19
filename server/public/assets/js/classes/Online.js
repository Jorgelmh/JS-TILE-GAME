import Engine from './Engine.js'

/**
 * ================================
 *      ONLINE GAME ENGINE
 * ================================
 */
export default class Online extends Engine{

    constructor(map, colissionMatrix, tileSet, canvas, socket, playerID, server, skin){
        super(map, colissionMatrix, tileSet, canvas, skin)

        /* Online attributes recevied from the sever */
        this.playerID = playerID
        this.socketIO = socket

        /* Add to emit => the skin */
        this.socketIO.emit('New Player', {skin: this.skin})

        this.state = null
        this.server = server

        /* CALCULATE network speed */
        this.latency = 0

        /* Skins array of images */
        this.onlineSkins = []

        /* SOCKET LISTENERS */
        this.socketIO.on('state', (data) =>{
            this.state = data
            let currentPlayerPos = data.find((element) => element.playerId === this.playerID)

            if(currentPlayerPos){
                let startPoints = this.calculateLocalMap(currentPlayerPos.posX, currentPlayerPos.posY)

                this.tileMap.startX = startPoints.posX
                this.tileMap.startY = startPoints.posY
            }
            
        })

        /* When new players enter the lobby, they must load other users skins */
        this.socketIO.on('Load Skins', (data) => {
            data.srcArray.forEach((value) => {
                if(value != this.skin){
                    this.loadServerSkin(value)
                }
            })
        })

        /* when a new player enters, other people must load his skin */
        this.socketIO.on('Load New Skin', (data) =>{
            let element = this.onlineSkins.find((elem) => elem.src === data.src)
            if(!element && data.src != this.skin){
                this.loadServerSkin(data.src)
            }
        })


        this.socketIO.on('pong', (ms) => {
            this.latency= ms
        })
        setInterval(this.emitPlayerPosition, 1000/60)
    }

    /**
     * ==========================
     *      RENDER FUNCTION
     * ==========================
     * 
     * Called when the sprites are loaded by the engine
     */ 
    render = (timeSinceLastFrame) => {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)

        this.animateCharacter()
        this.calculateOffset()
        this.drawMap()
        this.drawObjects()
        this.drawOtherPlayers()
        this.drawCharacter(this.getPlayerRelativePosition())

        this.context.fillText(`FPS: ${this.FPS}`, this.tileMap.width - 100, 50)
        this.context.fillText(`Net: ${this.latency}ms`, this.tileMap.width - 100, 70)
        requestAnimationFrame(() => {

            /* FPS Counter */
            let now = new Date()
            timeSinceLastFrame = this.lastFrameTime ? (now - this.lastFrameTime): 0
                
            this.render(timeSinceLastFrame)

            this.lastFrameTime = now
            this.FPS = Math.floor(1/(timeSinceLastFrame/1000)) 
        })
    }

    /* Animating the local character with the info from the server */

    animateCharacter(){
        
        if(this.controls.goUp){
            if(!this.character.moveInterval)
                this.character.onMovingForward()
        }
        

        if(this.controls.goDown){   
            if(!this.character.moveInterval)
                this.character.onMovingBackwards()
        }

        if(this.controls.goRight){
            if(!this.character.moveInterval)
                this.character.onMovingRight()
        }
        
        if(this.controls.goLeft){
            if(!this.character.moveInterval)
                this.character.onMovingLeft()
        }
    }

    /* Send the info back to the server */
    emitPlayerPosition = () =>{
        this.socketIO.emit('movement', {
            id: this.playerID,
            controls: this.controls,
            character: {
                currentSprite: {
                    x: this.character.currentSprite.x,
                    y: this.character.currentSprite.y
                }
            }
        })
    }

    /* Calculates the position of the map in the browser => startX and startY */
    calculateLocalMap(x, y){
        let serverWidth = this.transformServerMagnitudes(x)
        let serverHeight = this.transformServerMagnitudes(y)

        let posX = (this.tileMap.width/2 - this.tile.width/2) - serverWidth
        let posY = (this.tileMap.height/2 - this.tile.height/2) - serverHeight

        return {
            posX, 
            posY
        }
    }

    /* Loops the other players and calls the drawOnlineCharacter to draw each player with the info from the socket */
    drawOtherPlayers(){
        if(this.state && this.state.length > 1){
            let otherPlayers = this.state.filter((player) => player.playerId !== this.playerID)

            for(let player of otherPlayers){
                
                let characterX = this.transformServerMagnitudes(player.posX)+this.tileMap.startX
                let characterY = this.transformServerMagnitudes(player.posY)+this.tileMap.startY

                /* If the character is outside the screen don't draw it */
                if(characterX >= 0 && characterX < this.tileMap.width && characterY+ this.tile.height >= 0 && characterY < this.tileMap.height && player.character){
                    let skin = (player.skin == this.skin)? this.character.spriteSheet.img : this.onlineSkins.find((elem) => elem.src.includes(player.skin))
                    if(skin){
                        this.drawOnlineCharacter({posX: characterX, posY: characterY}, player.character, skin )
                    }
                }
            }
        }
    }

    /* Draws the online players with the info from the server */
    drawOnlineCharacter(player, onlineCharacter, skin){

        this.context.drawImage(skin, onlineCharacter.currentSprite.x * this.character.spriteSheet.width, onlineCharacter.currentSprite.y * this.character.spriteSheet.height
                                , this.character.spriteSheet.width, this.character.spriteSheet.height, player.posX, player.posY, this.tile.width, this.tile.height)
    }

    /* Uses the rule of three mathematica formula to transform values from the server */
    transformServerMagnitudes(serverValue){
        return (this.tileMap.width * serverValue) / this.server.width
    }

    /* Load new skin from the server */

    loadServerSkin(src){
        let characterSkin = new Image()
        characterSkin.src = `../assets/characters/${src}.png`
        this.onlineSkins.push(characterSkin)
    }

}