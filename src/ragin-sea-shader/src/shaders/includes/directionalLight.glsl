vec3 directionalLight(
        vec3 lightColor, 
        float lightIntensity, 
        vec3 vNormal, 
        vec3 lightPosition, 
        vec3 viewDirection, 
        float specularPower
    )
{
    vec3 lightDirection = normalize(lightPosition);
    vec3 lightReflection = reflect(-lightDirection, vNormal);

    // shading
    float shading = dot(vNormal, lightDirection);

    // clamping para asegurarnos de que tenemos un minimo (0), si shading es negativo vamos a ser 0
    shading = max(0.0, shading);

    // specular
    // float specular = pow( max(0.0, dot(lightReflection, viewDirection)), 16.0);
    float specular = - dot(lightReflection, viewDirection);
    specular = pow(specular, specularPower);

    // return lightColor * lightIntensity;
    return  lightColor * lightIntensity * (shading + specular);
}   