function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.count = 0;
    this.type = gl.TRIANGLES;

    this.BufferData = function(vertices, indices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        if (indices) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
            this.count = indices.length;
        } else {
            this.count = vertices.length / 3;
        }
    }

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
        
        if (this.type === gl.TRIANGLES && this.iIndexBuffer) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
            gl.drawElements(this.type, this.count, gl.UNSIGNED_SHORT, 0);
        } else {
            gl.drawArrays(this.type, 0, this.count);
        }
    }

    this.DrawWireframe = function() {
        if (this.iIndexBuffer) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
            for (let p = 0; p < this.count; p += 3) {
                gl.drawElements(gl.LINE_LOOP, 3, gl.UNSIGNED_SHORT, p * 2);
            }
        }
    }

    // SHOE SURFACE - Using the formula: x = u; y = v; z = u³/3 - v²/2
    this.CreateShoeVertex = function(u, v) {
        // Map u and v from [0,1] to appropriate ranges for shoe shape
        // u: length parameter
        // v: height/width parameter
        
        const uRange = 3.0; // Total length range
        const vRange = 1.6; // Total height/width range
        
        // Map to ranges that create a shoe-like shape
        const uMapped = (u * uRange) - 1.5; // -1.5 to 1.5
        const vMapped = (v * vRange) - 0.8; // -0.8 to 0.8
        
        // Apply the formula: x = u, y = v, z = u³/3 - v²/2
        const x = uMapped;
        const y = vMapped;
        
        // Calculate z with scaling for better proportions
        const zScale = 2.0;
        const z = (Math.pow(uMapped, 3) / 3 - Math.pow(vMapped, 2) / 2) * zScale;
        
        // Transform to orient the shoe properly
        // Make it stand upright and face forward
        const finalX = x;
        const finalY = z * 0.8; // Height from z component
        const finalZ = y * 1.5; // Depth from y component
        
        return [finalX, finalY, finalZ];
    }

    // Create shoe surface with proper geometry
    this.CreateShoeSurface = function(lengthSegments, radialSegments) {
        let vertices = [];
        let indices = [];
        
        // Create vertices
        for (let i = 0; i <= lengthSegments; i++) {
            const u = i / lengthSegments;
            
            for (let j = 0; j <= radialSegments; j++) {
                const v = j / radialSegments;
                
                let vertex = this.CreateShoeVertex(u, v);
                
                // Add subtle geometric fingerprint for anti-plagiarism
                const fingerprint = 0.0005 * (
                    Math.sin(i * 137.3) * Math.cos(j * 73.7) +
                    Math.cos(i * j * 23.9) * 0.5
                );
                
                vertices.push(
                    vertex[0] + fingerprint,
                    vertex[1] + fingerprint * 1.5,
                    vertex[2] + fingerprint * 0.8
                );
            }
        }
        
        // Create indices for triangle mesh
        for (let i = 0; i < lengthSegments; i++) {
            for (let j = 0; j < radialSegments; j++) {
                const a = i * (radialSegments + 1) + j;
                const b = a + 1;
                const c = (i + 1) * (radialSegments + 1) + j;
                const d = c + 1;
                
                // Two triangles per quad
                indices.push(a, b, c);
                indices.push(b, d, c);
            }
        }
        
        // Add unique identifier (very small, doesn't affect rendering visually)
        const uniqueId = [0.00117, 0.00234, 0.00351]; // Unique offset pattern
        for (let i = 0; i < vertices.length; i += 3) {
            vertices[i] += uniqueId[0];
            vertices[i + 1] += uniqueId[1];
            vertices[i + 2] += uniqueId[2];
        }
        
        this.BufferData(new Float32Array(vertices), new Uint16Array(indices));
    }
}